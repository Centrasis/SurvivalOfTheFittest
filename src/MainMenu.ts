import { Engine, SceneOptions, Scene, Vector3, Color4, HemisphericLight, Mesh, MeshBuilder, FreeCamera, Effect } from "@babylonjs/core";
import { GameScene } from "./GameScene";
import { GameGUI } from "./GameGUI";
import { SurvivalOfTheFittestGame } from "./SurvivalOfTheFittestGame";

import { AdvancedDynamicTexture, StackPanel, Button, TextBlock, Rectangle, Control, Image, Slider } from "@babylonjs/gui";

export class MainMenuGUI extends GameGUI {
    constructor(name: string, resolution: [number, number], onStart: () => void) {
        super(name, resolution);

        const title = new TextBlock("title", "Survival of the Fittest");
        title.resizeToFit = true;
        title.fontFamily = "Ceviche One";
        title.fontSize = "64px";
        title.color = "white";
        title.resizeToFit = true;
        title.top = "14px";
        title.width = 0.8;
        title.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
        this.addControl(title);    

        const container = new Rectangle("centerContainer");
        container.width = 0.8;
        container.height = 0.3;
        container.thickness = 0;
        this.addControl(container);

        const startBtn = Button.CreateSimpleButton("start", "PLAY");
        startBtn.fontFamily = "Viga";
        startBtn.width = 0.2
        startBtn.fontSize = "20px";
        startBtn.height = "40px";
        startBtn.color = "white";
        startBtn.top = "-14px";
        startBtn.thickness = 0;
        startBtn.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
        container.addControl(startBtn);

        const quitBtn = Button.CreateSimpleButton("quit", "QUIT");
        quitBtn.fontFamily = "Viga";
        quitBtn.width = 0.2
        quitBtn.fontSize = "20px";
        quitBtn.height = "40px";
        quitBtn.color = "white";
        quitBtn.top = "34px";
        quitBtn.thickness = 0;
        quitBtn.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
        container.addControl(quitBtn);

        quitBtn.onPointerDownObservable.add(() => { 
            window.close();
        });

        startBtn.onPointerDownObservable.add(onStart);
    }
}

export class HostMenu extends GameGUI {
    constructor(name: string, resolution: [number, number], onMainMenu: () =>  void, onStart: (species_count: number) => void) {
        super(name, resolution);

        const title = new TextBlock("title", "Survival of the Fittest:\nHost");
        title.resizeToFit = true;
        title.fontFamily = "Ceviche One";
        title.fontSize = "64px";
        title.color = "white";
        title.resizeToFit = true;
        title.top = "14px";
        title.width = 0.8;
        title.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
        this.addControl(title);

        const container = new Rectangle("centerContainer");
        container.width = 0.8;
        container.height = 0.3;
        container.thickness = 0;
        this.addControl(container);

        let speciesCount = 2;

        const lbltext = new TextBlock("text1", "Anzahl der Spezies: " + String(speciesCount));
        lbltext.fontFamily = "Viga";
        lbltext.width = 0.2
        lbltext.fontSize = "20px";
        lbltext.height = "5%";
        lbltext.color = "white";
        lbltext.top = "-10%";
        lbltext.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
        container.addControl(lbltext);

        const slider = new Slider("Species");
        slider.step = 1;
        slider.minimum = 2;
        slider.maximum = 10;
        slider.value = 2;
        slider.width = 0.2
        slider.background = "green";
        slider.fontSize = "20px";
        slider.height = "5%";
        slider.color = "white";
        slider.top = "0%";
        slider.onValueChangedObservable.add((nr) => {
            speciesCount = nr;
            lbltext.text = "Anzahl der Spezies: " + String(speciesCount);
        });
        container.addControl(slider);

        const startBtn = Button.CreateSimpleButton("start", "Start");
        startBtn.fontFamily = "Viga";
        startBtn.width = 0.2
        startBtn.fontSize = "20px";
        startBtn.height = "40px";
        startBtn.color = "white";
        startBtn.top = "12%";
        startBtn.thickness = 0;
        startBtn.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
        container.addControl(startBtn);

        const backBtn = Button.CreateSimpleButton("start", "Zurück");
        backBtn.fontFamily = "Viga";
        backBtn.width = 0.2
        backBtn.fontSize = "20px";
        backBtn.height = "40px";
        backBtn.color = "white";
        backBtn.top = "25%";
        backBtn.thickness = 0;
        backBtn.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
        container.addControl(backBtn);

        backBtn.onPointerDownObservable.add(onMainMenu);
        startBtn.onPointerDownObservable.add(() => onStart(speciesCount));
    }
}

export class MainMenu extends GameScene {
    private onStartGame: (scene: GameScene) => void;

    constructor(name: string, onStartGame: (scene: GameScene) => void, engine: Engine, options?: SceneOptions) {
        super(name, engine, options);
        this.clearColor = new Color4(0, 0, 0, 1);
        this.onStartGame = onStartGame;
    }

    protected createMainMenu(): GameGUI {
        return new MainMenuGUI("MainMenu", 
            [1920, 1080],
            () => {
                this.gui.dispose();
                this.gui = this.createHostMenu();
        });
    }

    protected createHostMenu(): GameGUI {
        return new HostMenu("HostMenu", 
                            [1920, 1080],
                            () => {
                                this.gui.dispose();
                                this.gui = this.createMainMenu();
                            },
                            (species_count: number) => {
                                this.gui.dispose();
                                let g = new SurvivalOfTheFittestGame("SotFScene", this.getEngine());
                                g.metaGameInfo = {
                                    species_count: species_count
                                };
                                this.onStartGame(g);
                            }
                );
    }

    public load(): Promise<GameScene> {
        return new Promise<GameScene>((resolve, reject) => {
            setTimeout(() => {
                this.gui = this.createMainMenu();

                Effect.RegisterShader("fade",
                    "precision highp float;" +
                    "varying vec2 vUV;" +
                    "uniform sampler2D textureSampler; " +
                    "uniform float fadeLevel; " +
                    "void main(void){" +
                    "vec4 baseColor = texture2D(textureSampler, vUV) * fadeLevel;" +
                    "baseColor.a = 1.0;" +
                    "gl_FragColor = baseColor;" +
                    "}");

                super.load().then(() => resolve(this), (err) => reject(err));
            }, 2000);
        });
    }

    public unload(): Promise<GameScene> {
        return new Promise<GameScene>((resolve, reject) => {
            super.unload().then(() => {
                this.gui = undefined;
                resolve(this);
            }, (err) => {
                reject(err)
            });
        });
    }
}