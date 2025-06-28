import { cclegacy, _decorator, Animation, Component } from 'cc';
const { ccclass, property } = _decorator;
import { BackPackUI } from "./BackPackUI";
import { ShopUI } from "./ShopUI";
import { ChallengeUI } from "./ChallengeUI";
import { PanelType } from "./PanelType";

@ccclass
export class HomeUI extends Component {
    @property(ScrollView)
    menuAnim: ScrollView = null!;

    @property(BackPackUI)
    backPackUI: BackPackUI = null!;

    @property(ShopUI)
    shopUI: ShopUI = null!;

    @property(ChallengeUI)
    challengeUI: ChallengeUI = null!;

    onLoad() {
        this.curPanel = PanelType.Home;
    }

    start() {
        let e = this;
        this.backPackUI.init(this);
        this.shopUI.init(this);
        PanelType.Shop(),
        this.challengeUI.init(this);
        this.scheduleOnce(function() {
        this.menuAnim.play("menu_intro");
        }, 0.5);
    }

    gotoShop() {
        this.curPanel !== PanelType.Shop && this.shopUI.show();
    }

    gotoHome() {
        this.curPanel === PanelType.Shop && this.shopUI.hide(); (this.curPanel = PanelType.Home));
    }

}
