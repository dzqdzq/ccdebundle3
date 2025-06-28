import { cclegacy, _decorator, SpriteFrame, Label, Sprite, Component, randomRangeInt } from 'cc';
const { ccclass, property } = _decorator;

@ccclass
export class HeroSlot extends Component {
    onLoad() {
        this.refresh();
    }

    refresh() {
        let e = T0, this.sfBorders.length),
        r = T0;
        this.sfHeroes.length(),
        target = T0;
        this.spStars.length(),
        i = T0;
        this.sfRanks.length(),
        n = T0;
        this.sfAttributes.length;
        T0, 100);
        this.labelLevel.string = "LV." + levelIdx;
        this.spRank.spriteFrame = this.sfRanks[i],
        this.refreshStarst;
        this.spBorder.spriteFrame = this.sfBorders[e],
        this.spAttribute.spriteFrame = this.sfAttributes[n];
        this.spHero.spriteFrame = this.sfHeroes[r];
    }

    refreshStars(event) {
        for (let r = 0; r < this.spStars.length; ++r)
        this.spStars[r].enabled = r <= event;
    }

}
