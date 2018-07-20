import { IClass } from 'src/types';

// tslint:disable-next-line max-classes-per-file
export default class BaseModel<Data, Context> {
  public $data: Data;
  public $context: Context | null;

  constructor(data: Data, context: Context | null = null) {
    this.$data = data;
    this.$context = context;
  }

  public $destroy(): void {
    const names = Object.getOwnPropertyNames(this);
    const len = names.length;
    for (let i = 0; i < len; i += 1) {
      delete (this as any)[names[i]];
    }
  }

  public $createChild<C extends typeof BaseModel, ChildData>(
    ChildModel: C,
    data: ChildData
  ): BaseModel<ChildData, Context> {
    return new ChildModel(data, this.$context);
  }

  public $createChildren<C extends typeof BaseModel, ChildData>(
    ChildModel: C,
    dataList: ChildData[]
  ): Array<BaseModel<ChildData, Context>> {
    const { $context } = this;
    return dataList.map((data) => new ChildModel(data, $context));
  }

  public $implements(Type: IClass) {
    return this.constructor.$interfaces.indexOf(Type) >= 0;
  }
}
