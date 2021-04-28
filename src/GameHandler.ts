import { SpawnFactory, SpawnInfo, UpdateInfo } from "./SpawnFactory";
import Worker from "worker-loader!./app.worker";
import { Mesh } from "@babylonjs/core";
import { Controller } from "./Controller";
import { Action, ActionType, GameRejectReason, GameState, SVEGame, SVEGameInfo } from "svegamesapi";
import { SVEAccount } from "svebaselib";

export enum HandlerRole {
    Host,
    Client
}

export class InvokeControllerInfo {
    public controller: string
}

export class EventInfo {
    public objectName: string;
    public evt: any;
}

export interface GameEventMap {
    "message": string;
    "state": GameState;
    "spawn": Mesh;
    "update": MessageEvent;
}

export abstract class GameHandler extends SVEGame {
    public spawnFactory: SpawnFactory;
    protected worker: Worker;
    protected stateListeners: ((state: GameState) => void)[] = [];
    protected messageListeners: ((message: string) => void)[] = [];
    protected spawnListeners: ((mesh: Mesh) => void)[] = [];
    protected updateListeners: ((target: any, update: UpdateInfo) => void)[] = [];
    public state: GameState = GameState.UnReady;
    protected meshes: Mesh[] = [];
    protected controllers: Controller[] = [];
    protected activeController?: Controller = undefined;
    protected humanController?: Controller = undefined;

    getControllers(): any[] {
        return this.controllers;
    }

    public gethumanControllerName(): string {
        return (this.humanController === undefined) ? "" : this.humanController.getName();
    }

    public constructor(player: SVEAccount, info: SVEGameInfo, worker: Worker) {
        super(player, info);
        this.worker = worker;
        let self = this;
        /*this.worker.onmessage = function (event) {
            console.log("OnMessage")
            self.handleIncoming(event.data as Action);
        };*/
        this.worker.addEventListener("message", function (event) {
            console.log("EvtMessage")
            self.handleIncoming(event.data as Action);
        });
    }

    public addController(con: Controller) {
        if (this.controllers.find(c => c.getName() == con.getName()) !== undefined)
            return;

        this.controllers.push(con);
        if(this.humanController == undefined) {
            this.humanController = con;
        }
        this.handle({
            type: ActionType.Spawn,
            invoker: this.humanController.getName(),
            info: {
                name: con.getName(),
                objectClass: con.constructor.name,
            } as SpawnInfo
        })
    }

    public addSpawnEventListener(listener: (ev: Mesh) => void): void {
        this.spawnListeners.push(listener);
    }

    public addUpdateEventListener(listener: (target: any, update: UpdateInfo) => void): void {
        this.updateListeners.push(listener);
    }

    public addMessageEventListener(listener: (ev: string) => void): void {
        this.messageListeners.push(listener);
    }

    public addStateEventListener(listener: (ev: GameState) => void): void {
        this.stateListeners.push(listener);
    }

    public abstract getRole(): HandlerRole;
}

export class GameHandlerClient extends GameHandler {
    protected handleIncoming(action: Action) {
        switch(action.type) {
            case ActionType.Spawn:
                this.spawnFactory.process(action.info).then((spawn) => {
                    if (spawn !== undefined) {
                        this.spawnFactory.spawnedMeshes++;
                        this.meshes.push(spawn);
                        this.spawnListeners.forEach((listener) => {
                            listener(spawn!);
                        });

                        if (this.spawnFactory.meshesToSpawn > 0 && this.spawnFactory.meshesToSpawn == this.spawnFactory.spawnedMeshes) {
                            this.spawnFactory.onFinishedChunk();
                        }
                    }
                });
                
                break;
            case ActionType.GameState:
                this.state = action.info as GameState;
                this.stateListeners.forEach((listener) => {
                    listener(this.state);
                });
                break;
            case ActionType.Update:
                let info = action.info as UpdateInfo;
                
                let target: any = undefined;
                if (info.objectName == "SpawnFactory") {
                    target = this.spawnFactory;
                } else {
                    this.meshes.forEach(m => {
                        if(m.name == info.objectName) {
                            target = m;
                        }
                    });
                    if (target == undefined) {
                        this.controllers.forEach(c => {
                            if(typeof c.account == "string" && c.account == info.objectName) {
                                target = c;
                            } else {
                                if(typeof c.account !== "string") {
                                    if (c.account.getName() == info.objectName) {
                                        target = c;
                                    }
                                }
                            }
                        });
                    }
                }

                if (target !== undefined) {
                    target[info.field.name] = info.field.value; 
                    this.updateListeners.forEach((listener) => {
                        listener(target, info);
                    });
                }
                break;
            case ActionType.InvokeController: 
                let conInfo: InvokeControllerInfo = action.info as InvokeControllerInfo;
                let idx = this.controllers.findIndex((con) => {
                    if(typeof con.account == "string" && con.account == conInfo.controller) {
                        return true;
                    } else {
                        if(typeof con.account !== "string") {
                            if (con.account.getName() == conInfo.controller) {
                                return true;
                            }
                        }
                    }
                    return false;
                }) 
                if (idx > -1 && idx != undefined) {
                    this.controllers[idx].invoke().then(() => {
                        let next = this.controllers[(idx + 1) % this.controllers.length];
                        this.handle({
                            type: ActionType.InvokeController,
                            invoker: this.controllers[idx].getName(),
                            info: {
                                controller: (typeof next.account == "string") ? next.account : next.account.getName()
                            } as InvokeControllerInfo
                        });
                    });
                }                
                break;
            case ActionType.Event:                  
                    let ltarget: any = undefined;
                    if (action.info.objectName == "SpawnFactory") {
                        ltarget = this.spawnFactory;
                    } else {
                        this.meshes.forEach(m => {
                            if(m.name == action.info.objectName) {
                                ltarget = m;
                            }
                        });
                        if (ltarget == undefined) {
                            this.controllers.forEach(c => {
                                if(typeof c.account == "string" && c.account == action.info.objectName) {
                                    ltarget = c;
                                } else {
                                    if(typeof c.account !== "string") {
                                        if (c.account.getName() == action.info.objectName) {
                                            ltarget = c;
                                        }
                                    }
                                }
                            });
                        }
                    }
    
                    if (ltarget !== undefined) {
                        if(ltarget.onEvent !== undefined) {
                            ltarget.onEvent(action.info.evt);
                            /*this.updateListeners.forEach((listener) => {
                                listener(ltarget, action.info);
                            });*/
                        }
                    }
                    break;
        }
    }

    protected onJoin() {
        console.log("On JOIN!");
    }

    protected onAbort(reason: GameRejectReason) {
        console.log("On ABORT! Reason: ", reason);
    }

    public startGame(): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            if (this.state == GameState.UnReady)
                this.setReady();
            if (this.state !== GameState.Playing) {
                setTimeout(() => {
                    this.startGame().then(() => resolve());
                }, 1000);
            } else {
                resolve();
            }   
        });
    }

    public getRole(): HandlerRole {
        return HandlerRole.Client;
    }

    public setReady() {
        this.handle({
            type: ActionType.GameState,
            info: GameState.Ready
        } as Action);

        if (this.humanController !== undefined) {
            this.handle({
                type: ActionType.Update,
                info: {
                    objectName: (typeof this.humanController.account == "string") ? this.humanController.account : this.humanController.account.getName(),
                    field: {
                        name: "ready",
                        value: true
                    }
                } as UpdateInfo
            } as Action);
        }
    }

    public handle(action: Action) {
        super.handle(action);
        this.worker.postMessage(action);
    }
}

export class GameHandlerHost extends GameHandlerClient {
    public handle(action: Action) {
        super.handle(action);
        super.handleIncoming(action);
    }

    public getRole(): HandlerRole {
        return HandlerRole.Host;
    }

    public setReady() {
        super.setReady();
        if (this.state == GameState.UnReady)
            this.state = GameState.Ready;
    }

    public startGame(): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            if (this.state == GameState.UnReady)
                this.setReady();
            let ready = true;
            this.controllers.forEach(e => ready = ready && e.ready);
            if (ready) {
                this.handle({
                    type: ActionType.GameState,
                    info: GameState.Playing
                } as Action);
                super.startGame().then(() => {
                    resolve();
                }, err => reject());
            } else {
                setTimeout(() => {
                    this.startGame().then(() => resolve());
                }, 1000);
            }
        });
    }
}