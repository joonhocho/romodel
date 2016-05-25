import {
  forEach,
  setProperty,
  defineClassName,
  defineStatic,
  defineGetterSetter,
  inheritClass,
} from './util';


const SIGNATURE = {};
let defaultCache = true;


const createCleanObject = () => Object.create(null);


const createSetter = (key) => function set(value) {
  this._data[key] = value;
  delete this[key];
};


const getGetterFromPrototype = (obj, key) => {
  const {get} = Object.getOwnPropertyDescriptor(obj, key);
  if (!get) {
    throw new Error(`Getter must be set for property, '${key}'`);
  }
  return get;
};

let models = createCleanObject();


const getModel = (model) => typeof model === 'string' ? models[model] : model;


const createChildModel = (parent, Class, data) => new Class(data, parent._context, parent, parent._root);


const bypass = (x) => x;
const block = () => undefined;


const normalizeFieldMappingFn = (fn) => {
  switch (typeof fn) {
  case 'boolean':
    return fn ? bypass : block;
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
    return {map: [normalizeFieldMappingFn(type)]};
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


const isPromise = (x) => x != null && typeof x.then === 'function';


const mapPromise = (data, map, reject) => {
  if (isPromise(data)) {
    return data.then(map, reject);
  }
  return map(data);
};


const createModelMapFn = (Class) => function(data) {
  return mapPromise(data, (res) => res && createChildModel(this, Class, res));
};


const createDataGetter = (prototype, key) => {
  if (key in prototype) {
    return getGetterFromPrototype(prototype, key);
  }
  return function() { return this._data[key]; };
};


const createGetterWithCache = (key, getter) => function get() {
  const val = getter.call(this);
  setProperty(this, key, val);
  return val;
};


const createGetterWithMapForList = (key, getter, context) => function get() {
  let val = getter.call(this);
  if (val) {
    return mapPromise(val, (v) => v.map(context.map, this));
  }
  return val;
};


const createGetterWithMapForNonList = (key, getter, context) => function get() {
  return context.map.call(this, getter.call(this));
};


const updateMappingFunction = (container, key, fn) => {
  if (fn.$signature === SIGNATURE) {
    return createModelMapFn(fn);
  }

  if (typeof fn === 'string') {
    return function(data) {
      if (!models[fn]) {
        throw new Error(`Unknown field model. model='${fn}'`);
      }
      container[key] = createModelMapFn(models[fn]);
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
    map: function(data) {
      return fns.reduce((x, fn) => fn.call(this, x), data);
    },
  };
};


const createGetter = (prototype, key, type) => {
  let {
    map: fns,
    list,
    cache = defaultCache,
  } = normalizeFieldType(type);

  if (fns == null) {
    throw new Error('Invalid field transform function!');
  }

  let getter = createDataGetter(prototype, key);

  fns = fns.map(normalizeFieldMappingFn);

  if (fns.length) {
    let context;
    if (fns.length === 1) {
      context = createMapContextForSingleFunction(fns[0]);
    } else {
      context = createMapContextForMultipleFunctions(fns);
    }

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


export const config = (obj) => {
  if (typeof obj.cache === 'boolean') defaultCache = obj.cache;
};


export const list = (x) => ({
  ...normalizeFieldType(x),
  list: true,
});


export const get = getModel;


export const clear = () => { models = createCleanObject(); };


export const create = (Class, {
  base: Base = Model,
  interfaces = [],
  fields = createCleanObject(),
} = {}) => {
  const NewModel = class extends Base {};

  const {name} = Class;
  if (models[name]) {
    throw new Error(`'${name}' model already exists!`);
  }
  models[name] = NewModel;

  defineClassName(NewModel, name);
  defineStatic(NewModel, '$signature', SIGNATURE);
  defineStatic(NewModel, '$fields', fields);
  defineStatic(NewModel, '$interfaces', interfaces);

  [Class, Base].concat(interfaces).forEach((from) =>
      inheritClass(NewModel, from));

  forEach(fields, (type, key) => defineGetterSetter(
    NewModel.prototype,
    key,
    createGetter(NewModel.prototype, key, type),
    createSetter(key)
  ));

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
  list,
  create,
  get,
  clear,
  Model,
};
