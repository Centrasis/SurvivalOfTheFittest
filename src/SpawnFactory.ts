import { Vector3, Vector4 } from "@babylonjs/core";
import { Mesh } from "@babylonjs/core";
import { Scene } from "@babylonjs/core";

export abstract class SpawnFactory {
    protected scene: Scene;
    public spawnedMeshes: number = 0;
    public meshesToSpawn: number = 0;
    public onFinishedChunk: () => void;

    constructor(scene: Scene, onFinished: () => void) {
        this.scene = scene;
        this.onFinishedChunk = onFinished;
    }

    public abstract process(objectInfo: any): Promise<Mesh | undefined>;
}

export class SpawnInfo {
    objectClass: string;
    position: Vector3;
    rotation: Vector4;
    scale: Vector3;
    name: string;
    additional: any;
}

export class UpdateInfo {
    objectName: string;
    field: {
        name: string,
        value: any
    }
}