import {expect} from 'chai';
import {create, compile, clear, list} from '../lib';

if (typeof Promise === 'undefined') {
  require('es6-promise').polyfill();
}

describe('Model', () => {
  afterEach(() => clear());

  it('Basic', () => {
    const MyModel = create(
      class MyModel {
        // define a class method.
        getId() {
          return this.id;
        }
      },
      {
        // declare directly accessible fields
        fields: {
          // declare 'id' field with the default getter.
          id: true,
        },
      },
    );

    const a = new MyModel({id: 1, foo: 'bar'});

    // Accessing 'id' value
    expect(a.id).to.equal(1); // directly accessible since declared in 'fields'

    expect(a.getId()).to.equal(1); // access via calling a class method

    expect(a.$get('id')).to.equal(1); // accessible via pre-defined '$get' method

    expect(a.$data.id).to.equal(1); // accessible via '$data' method that returns the raw data

    // Accessing 'foo' value
    expect(a.foo).to.equal(undefined); // not directly accessible since not declared in 'fields'

    expect(a.$get('foo')).to.equal('bar'); // accessible via '$get' though not declared

    expect(a.$data.foo).to.equal('bar'); // or via '$data'
  });

  it('Class Methods / Getters / Static', () => {
    const Plus = create(
      class Plus {
        // static
        static plus1(obj) {
          return obj.value + 1;
        }

        // method
        plus2() {
          return this.value + 2;
        }

        // getter
        get plus3() {
          return this.value + 3;
        }
      },
      {
        fields: {
          value: true,
        },
      },
    );

    const a = new Plus({value: 4});

    expect(Plus.plus1(a)).to.equal(5); // static method

    expect(a.plus2()).to.equal(6); // member method

    expect(a.plus3).to.equal(7); // getter
  });

  it('Class Inheritance', () => {
    const ShapeModel = create(
      class Shape {
        // a static method
        static isShape(obj) {
          return obj instanceof ShapeModel;
        }

        // static property to be overriden
        static classId = 1;

        // a method
        getName() {
          return this.name;
        }

        // method to be overriden
        getClassName() {
          return 'Shape';
        }
      },
      {
        fields: {
          name: true,
        },
      },
    );

    const ShapeWithColorModel = create(
      class ShapeWithColor {
        // add a static property
        static isShapeWithColor(obj) {
          return obj instanceof ShapeWithColorModel;
        }

        // override a static property
        static classId = 2;

        // add new method
        getColor() {
          return this.color;
        }

        // override a method
        getClassName() {
          return 'ShapeWithColor';
        }
      },
      {
        base: ShapeModel,
        fields: {
          color: true,
        },
      },
    );

    const s = new ShapeModel({name: 'box'});

    expect(s).to.be.an.instanceof(ShapeModel);
    expect(s).to.not.be.an.instanceof(ShapeWithColorModel);

    // static
    expect(ShapeModel.isShape({})).to.be.false;
    expect(ShapeModel.isShape(s)).to.be.true;
    expect(ShapeModel.classId).to.equal(1);

    expect(s.name).to.equal('box');
    expect(s.getName()).to.equal('box');
    expect(s.getClassName()).to.equal('Shape');

    const c = new ShapeWithColorModel({name: 'red box', color: 'red'});

    expect(c).to.be.an.instanceof(ShapeModel);
    expect(c).to.be.an.instanceof(ShapeWithColorModel);

    // static
    expect(ShapeWithColorModel.isShape({})).to.be.false;
    expect(ShapeWithColorModel.isShape(s)).to.be.true;
    expect(ShapeWithColorModel.isShape(c)).to.be.true;
    expect(ShapeWithColorModel.isShapeWithColor({})).to.be.false;
    expect(ShapeWithColorModel.isShapeWithColor(s)).to.be.false;
    expect(ShapeWithColorModel.isShapeWithColor(c)).to.be.true;
    expect(ShapeWithColorModel.classId).to.equal(2);

    // Inherited field and method
    expect(c.name).to.equal('red box');
    expect(c.getName()).to.equal('red box');

    // Extended field and method
    expect(c.color).to.equal('red');
    expect(c.getColor()).to.equal('red');

    // Method override
    expect(c.getClassName()).to.equal('ShapeWithColor');
  });

  it('Parent / Child', () => {
    const ChildModel = create(
      class ChildModel {
        getName() {
          return this.name;
        }
      },
      {
        fields: {
          name: true,
        },
      },
    );

    const ParentModel = create(class ParentModel {}, {
      fields: {
        // declare 'child' field as 'ChildModel'.
        child: ChildModel,
        children: list(ChildModel),
      },
    });

    const p = new ParentModel({
      child: {name: 'a'},
      children: [{name: 'b'}, {name: 'c'}],
    });

    expect(p.child).to.be.an.instanceof(ChildModel);
    expect(p.children[0]).to.be.an.instanceof(ChildModel);
    expect(p.children[1]).to.be.an.instanceof(ChildModel);

    expect(p.child.name).to.equal('a');
    expect(p.child.getName()).to.equal('a');

    expect(p.children[0].name).to.equal('b');
    expect(p.children[0].getName()).to.equal('b');
  });

  it('can pass down optional context', () => {
    const GrandChild = create(class GrandChild {}, {
      fields: {
        id: true,
      },
    });

    const Child = create(class Child {}, {
      fields: {
        id: true,
        child: GrandChild,
      },
    });

    const Parent = create(class Parent {}, {
      fields: {
        child: Child,
      },
    });

    const context = {};
    const parent = new Parent({child: {child: {}}}, context);
    expect(parent.$context).to.equal(context);
    expect(parent.child.$context).to.equal(context);
    expect(parent.child.child.$context).to.equal(context);
  });

  it('passes down a root instance', () => {
    const GrandChild = create(class GrandChild {}, {
      fields: {
        id: true,
      },
    });

    const Child = create(class Child {}, {
      fields: {
        id: true,
        child: GrandChild,
      },
    });

    const Parent = create(class Parent {}, {
      fields: {
        child: Child,
      },
    });

    const parent = new Parent({child: {child: {}}});
    expect(parent.$root).to.equal(parent);
    expect(parent.child.$root).to.equal(parent);
    expect(parent.child.child.$root).to.equal(parent);
  });

  it('can create a child that is an instance of itself', () => {
    const Selfie = create(class Selfie {}, {
      fields: {
        child: 'Selfie',
      },
    });

    const parent = new Selfie({child: {}});
    expect(parent).to.be.an.instanceof(Selfie);
    expect(parent.child).to.be.an.instanceof(Selfie);
  });

  it('can create a child of future model class', () => {
    const Present = create(class Present {}, {
      fields: {
        child: 'Future',
        children: list([(x) => x, 'Future', (x) => x]),
      },
    });

    const Future = create(class Future {});

    let parent = new Present({child: {}});
    expect(parent.child).to.be.an.instanceof(Future);

    // repeat
    parent = new Present({child: {}});
    expect(parent.child).to.be.an.instanceof(Future);

    // children
    parent = new Present({children: [{}, {}]});
    expect(parent.children[0]).to.be.an.instanceof(Future);
    expect(parent.children[1]).to.be.an.instanceof(Future);

    // children repeat
    parent = new Present({children: [{}, {}]});
    expect(parent.children[0]).to.be.an.instanceof(Future);
    expect(parent.children[1]).to.be.an.instanceof(Future);
  });

  it('combines getter and Model', () => {
    const Parent = create(
      class Parent {
        get child() {
          return {id: this.childId};
        }

        get children() {
          return [{id: this.childId}];
        }
      },
      {
        fields: {
          childId: true,
          child: 'Child',
          children: list('Child'),
        },
      },
    );

    const Child = create(class Child {}, {
      fields: {
        id: true,
      },
    });

    const parent = new Parent({childId: 3});

    expect(parent.child).to.be.an.instanceof(Child);
    expect(parent.child.id).to.equal(3);

    expect(parent.children[0]).to.be.an.instanceof(Child);
    expect(parent.children[0].id).to.equal(3);
  });

  it('can transform field value with a mapping function', () => {
    const Simple = create(class Simple {}, {
      fields: {
        bool: Boolean,
        bools: list(Boolean),
        serialized: JSON.stringify,
        unserialized: JSON.parse,
        bool2(bool2) {
          return [this.bool, Boolean(bool2)];
        },
        bools2(bools2) {
          return this.bools.concat(bools2.map(Boolean));
        },
      },
    });

    expect(new Simple({}).bool).to.be.false;
    expect(new Simple({bool: 1}).bool).to.be.true;
    expect(new Simple({bool: null}).bool).to.be.false;

    expect(new Simple({bools: null}).bools).to.be.null;
    expect(new Simple({bools: []}).bools).to.eql([]);
    expect(new Simple({bools: [1, true, 0, false, null, '']}).bools).to.eql([
      true,
      true,
      false,
      false,
      false,
      false,
    ]);

    expect(new Simple({}).serialized).to.equal(JSON.stringify(undefined));
    expect(new Simple({serialized: null}).serialized).to.equal(
      JSON.stringify(null),
    );
    expect(new Simple({serialized: {a: 1}}).serialized).to.equal(
      JSON.stringify({a: 1}),
    );

    expect(() => new Simple({}).unserialized).to.throw();
    expect(new Simple({unserialized: null}).unserialized).to.eql(null);
    expect(
      new Simple({unserialized: JSON.stringify({a: 1})}).unserialized,
    ).to.eql({a: 1});

    expect(new Simple({bool: 1, bool2: 0}).bool2).to.eql([true, false]);
    expect(new Simple({bools: [1, 0], bools2: [0, 1]}).bools2).to.eql([
      true,
      false,
      false,
      true,
    ]);
  });

  it('supports mapping functions on methods', (done) => {
    const Parent = create(
      class Parent {
        getChild(add) {
          return {id: add + this.childId};
        }

        getChildren(add) {
          return [{id: add + this.childId}];
        }

        getChildP(add) {
          return Promise.resolve({id: add + this.childId});
        }

        getChildrenP(add) {
          return Promise.resolve([{id: add + this.childId}]);
        }
      },
      {
        fields: {
          childId: true,
          getChild: 'Child',
          getChildren: list('Child'),
          getChildP: 'Child',
          getChildrenP: list('Child'),
        },
      },
    );

    const Child = create(class Child {}, {
      fields: {
        id: true,
      },
    });

    const parent = new Parent({childId: 3});

    const child = parent.getChild(2);
    expect(child).to.be.an.instanceof(Child);
    expect(parent.getChild(2)).to.not.equal(child);
    expect(child.id).to.equal(5);

    const children = parent.getChildren(1);
    expect(children[0]).to.be.an.instanceof(Child);
    expect(parent.getChildren(1)).to.not.equal(children);
    expect(children[0].id).to.equal(4);

    Promise.all([
      parent.getChildP(2).then((childP) => {
        expect(childP).to.be.an.instanceof(Child);
        expect(parent.getChildP(2)).to.not.equal(parent.getChildP(2));
        expect(childP.id).to.equal(5);
      }),
      parent.getChildrenP(1).then((childrenP) => {
        expect(childrenP[0]).to.be.an.instanceof(Child);
        expect(parent.getChildrenP(1)).to.not.equal(parent.getChildrenP(1));
        expect(childrenP[0].id).to.equal(4);
      }),
    ]).then(() => done(), done);
  });

  it('User', () => {
    // Create a Node model
    const Node = create(
      class Node {
        static isNode(obj) {
          return obj instanceof Node;
        }

        get type() {
          return this.constructor.name;
        }
      },
      {
        fields: {
          id: true,
        },
      },
    );

    // Create a InfoInterface model
    const InfoInterface = create(class InfoInterface {}, {
      fields: {
        isPublic: true,
      },
    });

    // Create a InfoBase model
    const InfoBase = create(
      class InfoBase {
        static isInfo = (obj) => obj instanceof InfoBase;

        get user() {
          return this.$parentOfType('User');
        }

        isSharedWith(user) {
          return this.user.isFriendsWith(user);
        }
      },
    );

    // Create a Name model
    const NameModel = create(
      class Name {
        static isName(obj) {
          return obj instanceof NameModel;
        }

        getFirstAndLastName() {
          return [this.firstName, this.lastName];
        }

        get shortName() {
          return `${this.firstName} ${this.lastName}`;
        }

        get profile() {
          return this.$parent;
        }

        get profile2() {
          return this.$parentOfType(Profile);
        }

        get profile3() {
          return this.$parentOfType('Profile');
        }
      },
      {
        base: InfoBase,
        interfaces: [Node, InfoInterface],
        fields: {
          firstName: true,
          lastName: true,
        },
      },
    );

    // Create a Profile model
    const Profile = create(class Profile {}, {
      fields: {
        names: list(NameModel),
      },
    });

    // Create a User model
    const User = create(
      class User {
        get friends() {
          return this.$get('friendIds').map((id) => ({id}));
        }

        isFriendsWith(user) {
          return this.$get('friendIds').indexOf(user.id) > -1;
        }
      },
      {
        interfaces: [Node],
        fields: {
          profile: Profile,
        },
      },
    );

    // Create a user instance
    const user = new User({
      id: '1',
      profile: {
        names: [{id: 'n1', firstName: 'F', lastName: 'L', isPublic: true}],
      },
      friendIds: ['2', '4'],
      hiddenField: 1,
    });

    // static declared by interface Node
    expect(user.id).to.equal('1');

    // dynamic field defined by interface Node
    expect(user.type).to.equal('User');

    // undeclared field access
    expect(user.friendIds).to.be.undefined;

    // access undeclared field
    expect(user.$get('friendIds')).to.eql(['2', '4']);

    // hidden field access
    expect(user.hiddenField).to.be.undefined;

    // access hidden field
    expect(user.$get('hiddenField')).to.equal(1);

    // set hidden field
    user.hiddenField = 3;
    expect(user.hiddenField).to.equal(3);
    expect(user.$get('hiddenField')).to.equal(1);

    // constructor
    expect(user.constructor).to.equal(User);

    // instanceof
    expect(user).to.be.an.instanceof(User);

    // $implements
    expect(user.$implements(Node)).to.be.true;

    // dynamic field
    expect(user.friends.map(({id}) => id)).to.eql(user.$data.friendIds);

    // method
    expect(user.isFriendsWith({id: '2'})).to.be.true;
    expect(user.isFriendsWith({id: '1'})).to.be.false;

    // instance field
    const {profile} = user;
    expect(profile).to.be.an.instanceof(Profile);

    // cached
    expect(profile).to.equal(user.profile);

    // instance list field
    const {
      names: [name],
    } = profile;
    expect(name.constructor).to.equal(NameModel);
    expect(name).to.be.an.instanceof(NameModel);

    // cached
    expect(name).to.equal(user.profile.names[0]);

    // base class
    expect(name).to.be.an.instanceof(InfoBase);

    // interfaces
    expect(name.$implements(Node)).to.be.true;
    expect(name.$implements(InfoInterface)).to.be.true;

    // field declared by Node
    expect(name.id).to.equal('n1');

    // field declared by Node
    expect(name.type).to.equal('Name');

    // declared field
    expect(name.firstName).to.equal('F');

    // declared field
    expect(name.lastName).to.equal('L');

    // method
    expect(name.getFirstAndLastName()).to.eql(['F', 'L']);

    expect(name.shortName).to.equal('F L');

    // $parent
    expect(name.profile).to.equal(profile);

    // $parentOfType
    expect(name.profile2).to.equal(profile);
    expect(name.profile3).to.equal(profile);

    // $parentOfType declared by InfoBase
    expect(name.user).to.equal(user);

    // $parent
    expect(name.$parent.$parent).to.equal(user);

    // inherited from base
    expect(name.user).to.equal(user);

    // inherited from base
    expect(name.isSharedWith(user)).to.be.false;
    expect(name.isSharedWith({id: '2'})).to.be.true;
    expect(name.isSharedWith({id: '3'})).to.be.false;

    // inherited from InfoInterface
    expect(name.isPublic).to.be.true;

    // static method
    expect(NameModel.isName(name)).to.be.true;
    expect(NameModel.isName(user)).to.be.false;
    expect(NameModel.isInfo(user)).to.be.false;
    expect(NameModel.isInfo(name)).to.be.true;
    expect(NameModel.isInfo).to.equal(InfoBase.isInfo);

    // clear cache
    expect(profile.names[0]).to.equal(name);
    delete profile.names;
    expect(profile.names[0]).to.not.equal(name);
    expect(profile.names[0].id).to.equal(name.id);

    // destory
    user.$destroy();
    expect(() => user.id).to.throw();
    expect(user.$parent).to.be.undefined;
  });

  it('can handle promise value', (done) => {
    const Value = create(class Value {}, {
      fields: {
        v: true,
      },
    });

    const Model = create(
      class Model {
        get pValue() {
          return Promise.resolve({v: 1});
        }

        get pValues() {
          return Promise.resolve([{v: 1}, {v: 2}]);
        }
      },
      {
        fields: {
          pValue: [Value],
          pValues: {
            map: [Value],
            list: true,
          },
        },
      },
    );

    const model = new Model({});

    Promise.all([
      model.pValue.then((pValue) => {
        expect(pValue).to.be.an.instanceof(Value);
        expect(pValue.v).to.equal(1);
      }),
      model.pValues.then((value) => {
        const [a, b] = value;
        expect(a).to.be.an.instanceof(Value);
        expect(a.v).to.equal(1);

        expect(b).to.be.an.instanceof(Value);
        expect(b.v).to.equal(2);
      }),
    ]).then(() => done(), done);
  });

  it('Parent / Child with delayed compile for circular references', () => {
    const Parent = create(class P1 {}, {
      fields: () => ({
        child: Child,
      }),
    });

    const Child = create(class C1 {}, {
      fields: () => ({
        parent: Parent,
      }),
    });

    const p = new Parent({
      child: {
        parent: {child: {}},
      },
    });

    expect(p).to.be.an.instanceof(Parent);
    expect(p.child).to.not.be.an.instanceof(Child);

    compile();

    expect(p.child).to.be.an.instanceof(Child);
    expect(p.child.parent).to.be.an.instanceof(Parent);
    expect(p.child.parent.child).to.be.an.instanceof(Child);
    expect(p.child.parent.child.parent).to.be.undefined;
  });
});
