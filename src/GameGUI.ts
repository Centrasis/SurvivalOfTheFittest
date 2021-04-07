import { AdvancedDynamicTexture, Control } from "@babylonjs/gui";

export class GameGUI {
    private gui: AdvancedDynamicTexture;
    private name: string;
    private controls: Control[];

    constructor(name: string, resolution: [number, number]) {
        this.gui = AdvancedDynamicTexture.CreateFullscreenUI("UI");
        this.gui.idealHeight = resolution[1];
        this.gui.idealWidth = resolution[0];
        this.name = name;
        this.controls = [];
    }

    protected getGUIRoot(): AdvancedDynamicTexture {
        return this.gui;
    }

    protected addControl(c: Control) {
        this.controls.push(c);
        this.gui.addControl(c);
    }

    public getName(): string {
        return this.name;
    }

    public dispose() {
        this.controls.forEach(element => {
            this.gui.removeControl(element);
        });
    }
}