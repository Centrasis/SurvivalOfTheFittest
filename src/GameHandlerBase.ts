export enum ActionType {
    Spawn,
    Update,
    Message,
    GameState,
    InvokeController,
    Event
}

export class Action {
    public type: ActionType;
    public info: any;
    public invoker: string;
}

export interface IGameHandler {
    handle(action: Action);

    getLocalPlayerName(): string;

    getControllers(): any[];
}