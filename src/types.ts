export type WithProp<O extends IAnyObject, K extends string, V> = O &
  { [k in K]: V };

export interface IAnyObject {
  [key: string]: any;
  [key: number]: any;
}

export interface IClass {
  new (...args: any[]): any;
}
