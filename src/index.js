import {
  forEach,
  setProperty,
  defineClassName,
  defineStatic,
  defineGetterSetter,
  inheritClass,
} from './util';


const SIGNATURE = {};


const createCleanObject = () => Object.create(null);


const createSetter = (key) => function set(value) {
  this._data[key] = value;
  delete this[key];
};


const getGetter = (obj, key) => {
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


const mapPromise = (data, map, reject) => {
  if (data && typeof data.then === 'function') {
    return data.then(map, reject);
  }
  return map(data);
};


const createModelMapFn = (Class) => function(data) {
  return mapPromise(data, (res) => res && createChildModel(this, Class, res));
};


const createGetter = (prototype, key, {map, list}) => {
  if (map == null) {
    throw new Error('Invalid field transform function!');
  }

  map = map.map(normalizeFieldMappingFn);

  const getter = key in prototype ?
      getGetter(prototype, key) :
      function() { return this._data[key]; };

  if (!map.length) {
    // No mapping functions.
    return getter;
  }

  let mapFn;
  if (map.length === 1) {
    // One mapping function.
    const fn = map[0];
    if (fn.$signature === SIGNATURE) {
      mapFn = createModelMapFn(fn);
    } else if (typeof fn === 'string') {
      mapFn = function(data) {
        if (!models[fn]) {
          throw new Error(`Unknown field model. model='${fn}'`);
        }
        mapFn = createModelMapFn(models[fn]);
        return mapFn.call(this, data);
      };
    } else {
      mapFn = fn;
    }
  } else {
    // Multiple mapping function.
    map = map.map((fn, i) => {
      if (fn.$signature === SIGNATURE) {
        return createModelMapFn(fn);
      }
      if (typeof fn === 'string') {
        return function(data) {
          if (!models[fn]) {
            throw new Error(`Unknown field model. model='${fn}'`);
          }
          fn = map[i] = createModelMapFn(models[fn]);
          return fn.call(this, data);
        };
      }
      return fn;
    });
    mapFn = function(data) {
      return map.reduce((x, fn) => fn.call(this, x), data);
    };
  }

  if (list) {
    // List type field.
    return function get() {
      let val = getter.call(this);
      if (val) val = mapPromise(val, (v) => v.map(mapFn, this));
      setProperty(this, key, val);
      return val;
    };
  }

  // Non-list type field.
  return function get() {
    const val = mapFn.call(this, getter.call(this));
    setProperty(this, key, val);
    return val;
  };
};


export const list = (x) => ({
  ...normalizeFieldType(x),
  list: true,
});


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
    createGetter(NewModel.prototype, key, normalizeFieldType(type)),
    createSetter(key)
  ));

  return NewModel;
};


export const get = getModel;


export const clear = () => { models = createCleanObject(); };


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
