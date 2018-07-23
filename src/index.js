import {
  forEach,
  setProperty,
  defineClassName,
  defineStatic,
  defineGetterSetter,
  defineMethod,
  inheritClass,
  isPromise,
  nullObject,
  getGetter,
  getValue,
} from './util';


const SIGNATURE = {};
let defaultCache = true;


const createSetter = (key) => function set(value) {
  this._data[key] = value;
  delete this[key];
};


const getGetterFromPrototype = (obj, key) => {
  const get = getGetter(obj, key);
  if (!get) {
    throw new Error(`Getter must be set for property, '${key}'`);
  }
  return get;
};

let models = nullObject();


const getModel = (model) => typeof model === 'string' ? models[model] : model;


const createChildModel = (parent, Class, data) => new Class(data, parent._context, parent, parent._root);


const block = () => undefined;


const normalizeFieldMappingFn = (fn) => {
  switch (typeof fn) {
  case 'boolean':
    if (fn) {
      return null;
    }
    break;
  case 'string':
    return models[fn] || fn;
  case 'function':
    return fn;
  default:
  }
  console.error(fn);
  throw new Error('Invalid field map function!');
};


const normalizeFieldType = (type) => {
  switch (typeof type) {
  case 'boolean':
  case 'string':
  case 'function':
    return {map: [normalizeFieldMappingFn(type)].filter((x) => x)};
  case 'object':
    if (Array.isArray(type)) {
      return {map: type};
    }
    if (type) {
      return {
        ...type,
        map: normalizeFieldType(type.map).map,
      };
    }
    break;
  default:
    // break;
  }
  console.error(type);
  throw new Error('Invalid field type!');
};


const mapPromise = (data, map, reject) => {
  if (isPromise(data)) {
    return data.then(map, reject);
  }
  return map(data);
};


const createChildModelFunction = (Class) => function(data) {
  return mapPromise(data, (res) => res && createChildModel(this, Class, res));
};


const createDataGetter = (key) => function get() {
  return this._data[key];
};


const updateMappingFunction = (container, key, fn) => {
  if (fn.$signature === SIGNATURE) {
    return createChildModelFunction(fn);
  }

  if (typeof fn === 'string') {
    return function(data) {
      if (!models[fn]) {
        throw new Error(`Unknown field model. model='${fn}'`);
      }
      container[key] = createChildModelFunction(models[fn]);
      return container[key].call(this, data);
    };
  }

  return fn;
};


const createMapContextForSingleFunction = (fn) => {
  const context = {};
  context.map = updateMappingFunction(context, 'map', fn);
  return context;
};


const createMapContextForMultipleFunctions = (fns) => {
  fns.forEach((fn, i) => fns[i] = updateMappingFunction(fns, i, fn));
  return {
    map(data) {
      return fns.reduce((x, fn) => fn.call(this, x), data);
    },
  };
};


const createMapContext = (fns) => {
  fns = fns && fns.map(normalizeFieldMappingFn).filter((x) => x);
  if (fns && fns.length) {
    if (fns.length === 1) {
      return createMapContextForSingleFunction(fns[0]);
    }
    return createMapContextForMultipleFunctions(fns);
  }
  return null;
};


const createGetterWithMapForList = (key, getter, context) => function get() {
  const val = getter.call(this);
  if (val) {
    return mapPromise(val, (v) => v.map(context.map, this));
  }
  return val;
};


const createGetterWithMapForNonList = (key, getter, context) => function get() {
  return context.map.call(this, getter.call(this));
};


const createGetterWithCache = (key, getter) => function get() {
  const val = getter.call(this);
  setProperty(this, key, val);
  return val;
};


const createMethodWithMapForList = (key, method, context) => function() {
  const val = method.apply(this, arguments);
  if (val) {
    return mapPromise(val, (v) => v.map(context.map, this));
  }
  return val;
};


const createMethodWithMapForNonList = (key, method, context) => function() {
  return context.map.call(this, method.apply(this, arguments));
};


const createGetter = (prototype, key, type) => {
  const {
    map: fns,
    list = false,
    cache = defaultCache,
  } = normalizeFieldType(type);

  let getter;
  if (key in prototype) {
    getter = getGetterFromPrototype(prototype, key);
  } else {
    getter = createDataGetter(key);
  }

  const context = createMapContext(fns);
  if (context) {
    if (list) {
      getter = createGetterWithMapForList(key, getter, context);
    } else {
      getter = createGetterWithMapForNonList(key, getter, context);
    }
  }

  if (cache) {
    getter = createGetterWithCache(key, getter);
  }

  return getter;
};


const createMethod = (prototype, key, type, method) => {
  const {
    map: fns,
    list = false,
  } = normalizeFieldType(type);

  const context = createMapContext(fns);
  if (context) {
    if (list) {
      method = createMethodWithMapForList(key, method, context);
    } else {
      method = createMethodWithMapForNonList(key, method, context);
    }
  }

  return method;
};


export const config = (obj) => {
  if (obj.cache !== undefined) defaultCache = Boolean(obj.cache);
};

const compileQueue = [];

export const compile = () => {
  const len = compileQueue.length;
  for (let i = 0; i < len; i += 1) {
    compileQueue[i]();
  }
  compileQueue.length = 0;
};

export const list = (x) => ({
  ...normalizeFieldType(x),
  list: true,
});


export const get = getModel;


export const clear = () => { models = nullObject(); };


export const create = (Class, {
  base: Base = Model,
  interfaces = [],
  fields = nullObject(),
} = {}) => {
  const NewModel = class extends Base {};

  const {name} = Class;
  if (models[name]) {
    throw new Error(`'${name}' model already exists!`);
  }
  models[name] = NewModel;

  defineClassName(NewModel, name);
  defineStatic(NewModel, '$signature', SIGNATURE);
  defineStatic(NewModel, '$interfaces', interfaces);

  [Class, Base].concat(interfaces).forEach((from) =>
    inheritClass(NewModel, from));

  const {prototype} = NewModel;

  const compileFields = (fields) => forEach(fields, (type, key) => {
    const value = getValue(prototype, key);
    if (typeof value === 'function') {
      defineMethod(
        prototype,
        key,
        createMethod(prototype, key, type, value)
      );
    } else {
      defineGetterSetter(
        prototype,
        key,
        createGetter(prototype, key, type),
        createSetter(key)
      );
    }
  });

  if (typeof fields === 'function') {
    compileQueue.push(() => compileFields(fields()));
  } else {
    compileFields(fields);
  }

  return NewModel;
};


export class Model {
  constructor(data, context = null, parent, root) {
    this._data = data;
    this._parent = parent || null;
    this._root = root || this;
    this._context = context;
  }

  $destroy() {
    Object.getOwnPropertyNames(this).forEach((key) => delete this[key]);
  }

  get $data() {
    return this._data;
  }

  $get(name) {
    return this._data[name];
  }

  get $parent() {
    return this._parent;
  }

  get $context() {
    return this._context;
  }

  get $root() {
    return this._root;
  }

  $parentOfType(type) {
    const ParentModel = getModel(type);
    let p = this;
    while (p = p._parent) {
      if (p instanceof ParentModel) {
        return p;
      }
    }
    return null;
  }

  $createChild(model, data) {
    return createChildModel(this, getModel(model), data);
  }

  $createChildren(model, dataList) {
    const Class = getModel(model);
    return dataList && dataList.map((data) => createChildModel(this, Class, data));
  }

  $implements(Type) {
    return this.constructor.$interfaces.indexOf(Type) >= 0;
  }
}


export default {
  config,
  compile,
  list,
  create,
  get,
  clear,
  Model,
};
