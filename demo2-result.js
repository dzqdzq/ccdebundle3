import { _decorator, Component, Node } from 'cc';
const { ccclass, property } = _decorator;

export class MyTest  {
    @property(Node)
    public node: Node = null!;

    @property
    public test = 100;

    public _count = 5;
    public count22 = 10;

    onLoad() {
        console.log('onLoad', this._count);
    }

    getCount1() {
        return this._count;
    }

    static getCount2() {
        return 5;
    }
}
