import { IAnyObject, WithProp } from 'src/types';

export const forEach = <O extends IAnyObject>(
  obj: O,
  fn: (value: O[keyof O], key: string, obj: O) => void
): void => {
  const keys = Object.keys(obj);
  const len = keys.length;
  for (let i = 0; i < len; i += 1) {
    const key = keys[i];
    fn(obj[key], key, obj);
  }
};

export const setProperty = <O extends IAnyObject, K extends string, V>(
  obj: O,
  key: K,
  value: V
): WithProp<O, K, V> =>
  Object.defineProperty(obj, key, {
    value,
    enumerable: true,
    writable: true,
    configurable: true,
  });

export const defineStatic = <O extends IAnyObject, K extends string, V>(
  obj: O,
  key: K,
  value: V
): WithProp<O, K, V> =>
  Object.defineProperty(obj, key, {
    value,
    writable: false,
    enumerable: false,
    configurable: true,
  });

export const defineMethod = <O extends IAnyObject, K extends string, V>(
  obj: O,
  key: K,
  value: V
): WithProp<O, K, V> =>
  Object.defineProperty(obj, key, {
    value,
    writable: true,
    enumerable: false,
    configurable: true,
  });

export const defineGetterSetter = <O extends IAnyObject, K extends string, V>(
  obj: O,
  name: K,
  get: (this: O) => V,
  set: (this: O, value: V) => void
): WithProp<O, K, V> =>
  Object.defineProperty(obj, name, {
    get,
    set,
    enumerable: true,
    configurable: true,
  });

export const defineLazyProperty = <O extends IAnyObject, K extends string, V>(
  obj: O,
  key: K,
  getter: (this: O) => V,
  {
    writable = true,
    enumerable = true,
    configurable = true,
  }: {
    writable: boolean;
    enumerable: boolean;
    configurable: boolean;
  } = {
    writable: true,
    enumerable: true,
    configurable: true,
  }
): WithProp<O, K, V> =>
  Object.defineProperty(obj, key, {
    get(): V {
      // Use 'this' instead of obj so that obj can be a prototype.
      const value = getter.call(this);
      Object.defineProperty(this, key, {
        value,
        writable,
        enumerable,
        configurable,
      });
      return value;
    },
    enumerable,
    configurable: true,
  });

let defineClassName: <O extends IAnyObject, V extends string>(
  obj: O,
  value: V
) => O;

if (
  ((): boolean => {
    const A = class {};
    try {
      defineStatic(A, 'name', 'B');
      return A.name === 'B';
    } catch (e) {
      return false;
    }
  })()
) {
  defineClassName = <O extends IAnyObject, V extends string>(
    obj: O,
    value: V
  ): O => defineStatic(obj, 'name', value);
} else {
  // Old Node versions require the following options to overwrite class name.
  defineClassName = <O extends IAnyObject, V extends string>(
    obj: O,
    value: V
  ): O =>
    Object.defineProperty(obj, 'name', {
      value,
      writable: false,
      enumerable: false,
      configurable: false,
    });
}
export { defineClassName };

export const inheritPropertyFrom = <
  O1 extends IAnyObject,
  O2 extends IAnyObject,
  K extends string,
  KT extends string
>(
  obj1: O1,
  obj2: O2,
  key: K,
  asKey?: KT
): KT extends string ? WithProp<O1, KT, O2[K]> : WithProp<O1, K, O2[K]> =>
  Object.defineProperty(obj1, asKey || key, Object.getOwnPropertyDescriptor(
    obj2,
    key
  ) as any);

type Inherit<O1 extends IAnyObject, O2 extends IAnyObject, E> = O1 &
  Pick<O2, Exclude<keyof O2, keyof O1 | E>>;

export const inheritFrom = <
  O1 extends IAnyObject,
  O2 extends IAnyObject,
  E extends { [k: string]: 1 }
>(
  obj1: O1,
  obj2: O2,
  excludes?: E
): Inherit<O1, O2, keyof E> => {
  const aKeys = Object.getOwnPropertyNames(obj1);
  const bKeys = Object.getOwnPropertyNames(obj2);

  let keys = bKeys.filter((key) => aKeys.indexOf(key) === -1);
  if (excludes) {
    keys = keys.filter((key) => excludes[key] !== 1);
  }

  keys.forEach((key) => inheritPropertyFrom(obj1, obj2, key));
  return obj1 as any;
};

const classProps: { length: 1; name: 1; prototype: 1 } = {
  length: 1,
  name: 1,
  prototype: 1,
};
type InheritStatic<O1, O2> = Inherit<O1, O2, keyof typeof classProps>;

// tslint:disable-next-line typedef
export const inheritStatic = <O1 extends IAnyObject, O2 extends IAnyObject>(
  obj1: O1,
  obj2: O2
) => inheritFrom(obj1, obj2, classProps);

const protoProps: { constructor: 1 } = { constructor: 1 };
type InheritPrototype<O1, O2> = Inherit<O1, O2, keyof typeof protoProps>;
// tslint:disable-next-line typedef
export const inheritPrototype = <O1 extends IAnyObject, O2 extends IAnyObject>(
  proto1: O1,
  proto2: O2
) => inheritFrom(proto1, proto2, protoProps);

export const inheritClass = <
  O1 extends {
    prototype: IAnyObject;
    new (...args: any[]): any;
  },
  O2 extends {
    prototype: IAnyObject;
  }
>(
  obj1: O1,
  obj2: O2
): {
  prototype: InheritPrototype<O1['prototype'], O2['prototype']>;
  new (...args: any[]): InheritPrototype<O1['prototype'], O2['prototype']>;
} & InheritStatic<O1, O2> => {
  inheritStatic(obj1, obj2);
  inheritPrototype(obj1.prototype, obj2.prototype);
  return obj1 as any;
};

export const isPromise = (x: any): boolean =>
  x != null && typeof x.then === 'function';

export const nullObject = (): {} => Object.create(null);

export const getGetter = <O extends IAnyObject, K extends string>(
  obj: O,
  key: K
): (() => O[K]) | undefined => {
  const desc = Object.getOwnPropertyDescriptor(obj, key);
  return (desc && desc.get) || undefined;
};

export const getValue = <O extends IAnyObject, K extends string>(
  obj: O,
  key: K
): O[K] | undefined => {
  const desc = Object.getOwnPropertyDescriptor(obj, key);
  return desc && desc.value;
};

export const mapPromise = <T, V>(
  data: T | PromiseLike<T>,
  map: (v: T) => V,
  reject: any
): V | PromiseLike<V> => {
  if (data != null && typeof (data as any).then === 'function') {
    return (data as PromiseLike<T>).then(map, reject);
  }
  return map(data as T);
};
