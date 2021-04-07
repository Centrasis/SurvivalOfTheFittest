import { Engine, SceneOptions, Scene, Vector3, Camera, FreeCamera } from "@babylonjs/core";
import { GameGUI } from "./GameGUI";
import { GameHandler } from "./GameHandler";

export abstract class GameScene extends Scene {
    protected camera: Camera;
    protected gui?: GameGUI;
    private loaded: boolean = false;
    private name: string;
    public gameHandler: GameHandler; 

    constructor(name: string, engine: Engine, options?: SceneOptions) {
        super(engine, options);
        this.camera = new FreeCamera("camera", new Vector3(0, 0, 0), this);
        this.gui = undefined;
        this.name = name;
    }

    public equals(other?: GameScene): boolean {
        if (other === undefined || other === null)
            return false;
        return other.name == this.name;
    }

    public init(gh: GameHandler) {
        this.gameHandler = gh;
    }

    public load(): Promise<GameScene> {
        return new Promise<GameScene>((resolve, reject) => {
            this.attachControl();
            this.loaded = true;
            resolve(this);
        });
    }
    public unload(): Promise<GameScene> {
        return new Promise<GameScene>((resolve, reject) => {
            this.detachControl();
            this.loaded = false;
            resolve(this);
        });
    }

    public getName(): string {
        return this.name;
    }

    public render(updateCameras?: boolean, ignoreAnimations?: boolean): void {
        if (this.loaded) {
            super.render(updateCameras, ignoreAnimations);
        }
    }
}