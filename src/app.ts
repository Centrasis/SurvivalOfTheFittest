import "@babylonjs/core/Debug/debugLayer";
import "@babylonjs/inspector";
import "@babylonjs/loaders/glTF";
import { Engine, DefaultLoadingScreen, EngineFactory } from "@babylonjs/core";
import { GameScene } from "./GameScene";
import { MainMenu } from "./MainMenu";
import Worker from "worker-loader!./app.worker";
import { GameHandler, GameHandlerClient, GameHandlerHost } from "./GameHandler";
import { SVELoadingScreen } from "./LoadingScreen";
import { SVEAccount, SVESystemInfo } from "svebaselib";
import { GameState, SVEGameInfo, SVEGameServer } from "svegamesapi";
import { GameLobby } from "./GameLobby";


enum AppState {
    MainMenu = 0,
    Matchmaking,
    Lobby,
    Playing,
    GameFinished
}

class App {
    private _MainMenu: GameScene;
    private _canvas: HTMLCanvasElement;
    private _engine: Engine;
    private _state: AppState = AppState.MainMenu;
    private isBusy: boolean = true;
    private currentScene?: GameScene | undefined;
    private worker: Worker;
    private gameHandler: GameHandler;
    private params: URLSearchParams;
    private localUser: SVEAccount | undefined = undefined;

    constructor(checkForInstall: boolean = true) {
        if (checkForInstall) {
            window.addEventListener('beforeinstallprompt', (e) => {
                
            });
        }

        this.params = new URLSearchParams(window.location.search);

        this.worker = new Worker();

        SVESystemInfo.getInstance().sources.sveService = process.env.sveAPI || window.location.hostname.replace("www.", "media.").replace("sve.", "media.");
        SVESystemInfo.getInstance().sources.authService = process.env.authAPI || window.location.hostname.replace("www.", "accounts.").replace("sve.", "accounts.") + "/auth";
        SVESystemInfo.getInstance().sources.accountService = process.env.accountsAPI || window.location.hostname.replace("www.", "accounts.").replace("sve.", "accounts.");
        SVESystemInfo.getInstance().sources.gameService = process.env.gameAPI || window.location.hostname.replace("www.", "games.").replace("sve.", "games.");
        SVESystemInfo.getInstance().sources.aiService = process.env.aiAPI || window.location.hostname.replace("www.", "ai.").replace("sve.", "ai.");

        this._canvas = this._createCanvas();
        this.currentScene = undefined;
        this._init();
    }

    //set up the canvas
    private _createCanvas(): HTMLCanvasElement {
        //Commented out for development
        document.documentElement.style["overflow"] = "hidden";
        document.documentElement.style.overflow = "hidden";
        document.documentElement.style.width = "100%";
        document.documentElement.style.height = "100%";
        document.documentElement.style.margin = "0";
        document.documentElement.style.padding = "0";
        document.body.style.overflow = "hidden";
        document.body.style.width = "100%";
        document.body.style.height = "100%";
        document.body.style.margin = "0";
        document.body.style.padding = "0";

        //create the canvas html element and attach it to the webpage
        this._canvas = document.createElement("canvas");
        this._canvas.style.width = "100%";
        this._canvas.style.height = "100%";
        this._canvas.id = "gameCanvas";
        document.body.appendChild(this._canvas);

        return this._canvas;
    }

    private async _init(): Promise<void> {
        this._engine = (await EngineFactory.CreateAsync(this._canvas, undefined)) as Engine;
        this._engine.loadingScreen = new SVELoadingScreen(this._engine.loadingScreen as DefaultLoadingScreen);

        if (this.params.has("sessionID")) {
            new SVEAccount(this.params.get("sessionID"), (usr) => {
                console.log("Go user credentials Play Game..");
                this.localUser = usr;
                let gameName = (this.params.has("name")) ? this.params.get("name") : "";
                SVEGameServer.listGames(this.localUser).then(games => {
                    let gi: SVEGameInfo | undefined = undefined;
                    games.forEach(g => {
                        if (g.name == gameName)
                            gi = g;
                    });

                    if (gi == undefined) {
                        SVEGameServer.hostGame({
                            host: (this.localUser! as (SVEAccount | string)),
                            id: -1,
                            type: "Survival",
                            maxPlayers: 10,
                            minPlayers: 2,
                            name: "Survival" + String(Math.floor(Math.random() * 10000)),
                            playersCount: 0,
                            state: GameState.UnReady
                        } as SVEGameInfo).then(gi => {
                            this._MainMenu = new GameLobby("GameLobby", gi, this.localUser, (game: GameScene) => {
                                console.log("Hosted Game!");
                                this._state = AppState.Playing;
                                this.gameHandler = new GameHandlerHost(this.localUser, gi, this.worker);
                                this.gameHandler.setMetaInfos(game.metaGameInfo).then(() => {
                                    game.init(this.gameHandler);
                                    this.gameHandler.startGame().then(() => this.setActiveScene(game));
                                });
                            }, this._engine);
                        });
                    } else {
                        this._MainMenu = new GameLobby("GameLobby", gi, this.localUser, (game: GameScene) => {
                            this._state = AppState.Playing;
                            console.log("Joined Game!");
                            this.gameHandler = new GameHandlerClient(this.localUser, gi, this.worker);
                            game.init(this.gameHandler);
                            this.gameHandler.startGame().then(() => this.setActiveScene(game));
                        }, this._engine);
                    }
                });
            });
        } else {
            this._MainMenu = new MainMenu("MainMenu", (game: GameScene) => {
                this._state = AppState.Playing;
                      
                SVEGameServer.hostGame({
                    host: (this.localUser! as (SVEAccount | string)),
                    id: -1,
                    type: "Survival",
                    maxPlayers: 10,
                    minPlayers: 2,
                    name: "Survival" + String(Math.floor(Math.random() * 10000)),
                    playersCount: 0,
                    state: GameState.UnReady
                } as SVEGameInfo).then(gi => {
                    console.log("Hosted Game!");
                    this.gameHandler = new GameHandlerHost(this.localUser, gi, this.worker);
                    this.gameHandler.setMetaInfos(game.metaGameInfo).then(() => {
                        game.init(this.gameHandler);
                        this.gameHandler.startGame().then(() => this.setActiveScene(game));
                    });
                });
            }, this._engine);
        }

        //**for development: make inspector visible/invisible
        window.addEventListener("keydown", (ev) => {
            //Shift+Ctrl+Alt+I
            if (ev.shiftKey && ev.ctrlKey && ev.altKey && ev.keyCode === 73) {
                if (this._MainMenu.debugLayer.isVisible()) {
                    this._MainMenu.debugLayer.hide();
                } else {
                    this._MainMenu.debugLayer.show();
                }
            }
        });

        //MAIN render loop & state machine
        await this.startMainLoop();
    }

    private async startMainLoop(): Promise<void> {
        this._engine.displayLoadingUI();

        // Register a render loop to repeatedly render the scene
        this._engine.runRenderLoop(() => {
            if (this.isBusy) {
                this._engine.displayLoadingUI();
            } else {
                this._engine.hideLoadingUI();
            }
                
            switch (this._state) {
                case AppState.MainMenu:
                    this.setActiveScene(this._MainMenu);
                    break;
                default: break;
            }

            if (this.currentScene !== undefined) {
                this.currentScene?.attachControl();
                this.currentScene?.render();
            }
        });

        window.addEventListener('resize', () => {
            this._engine.resize();
        });
    }

    private setActiveScene(scene: GameScene) {
        if (scene.equals(this.currentScene))
            return;

        if (this.currentScene !== undefined) {
            this.currentScene?.unload();
        }

        this.currentScene = scene;   

        this.isBusy = true;
        scene.load().then((s) => {
            console.log("loaded scene: " + scene.getName());              
            this.isBusy = false;
        }, err => {
            this._state = AppState.MainMenu;
            this.isBusy = true;
        });
    }

}
new App();