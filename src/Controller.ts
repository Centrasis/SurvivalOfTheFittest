import { GameState, GameInfo, SVEAccount, GameRequest } from 'svebaselib';
import { IGameHandler } from './GameHandlerBase';

export abstract class Controller {
    public account: SVEAccount | string;
    public ready: boolean = false;
    public abstract invoke(): Promise<Controller>;
    protected gameHandler: IGameHandler;

    constructor(account: SVEAccount | string, gh: IGameHandler) {
        this.account = account;
        this.gameHandler = gh;
    }

    public getName(): string {
        return (typeof this.account === "string" ? this.account : this.account.getName());
    }
}