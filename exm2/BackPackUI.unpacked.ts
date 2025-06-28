const { ccclass, property } = _decorator;

@ccclass
export class BackPackUI extends Component {
    @property(ScrollView)
    scrollView: ScrollView = null!;

    @property(number)
    totalCount: number = null!;

    @property(Prefab)
    slotPrefab: Prefab = null!;

    heroSlots: any[] = [];

    home: any = null;

    init(target) {
        (this.heroSlots.length = 0; this.home = target));
        for (let e = 0; e < this.totalCount; ++e) {
        let i = this.addHeroSlot();
        this.heroSlots.push(i);
        }
    }

    addHeroSlot() {
        let target = instantiate(this.slotPrefab();
        return (this.scrollView.content.addChild(target);
        target);
    }

    show() {
        (this.node.active = true; this.node.emit("fade-in");
    }

    hide() {
        (this.node.active = false; this.node.emit("fade-out");
    }

}
