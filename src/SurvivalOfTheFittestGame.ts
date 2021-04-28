import { GameScene } from "./GameScene";
import { Engine, SceneOptions, Scene, Vector3, HemisphericLight, Mesh, Space, HighlightLayer, Node, Texture, PickingInfo } from "@babylonjs/core";
import { AssetsManager, StandardMaterial, Color3, SceneLoader, Vector4, ArcRotateCamera, MeshBuilder } from '@babylonjs/core';
import { SpawnFactory, SpawnInfo, UpdateInfo } from "./SpawnFactory";
import { EventInfo, GameHandler, HandlerRole, InvokeControllerInfo } from "./GameHandler";
import { GameGUI } from "./GameGUI";
import { Controller } from "./Controller";
import { LoginState, SessionUserInitializer, SVEAccount } from "svebaselib";
import { ActionType, IGameHandler, SVEGameServer } from "svegamesapi";
import { Control, Image, Rectangle, TextBlock, TextWrapping } from "@babylonjs/gui";


enum FieldType {
    Alpine = 0,
    Desert,
    Forest,
    Mountain,
    Swamp,
    Water
}

enum ClickableType {
    Field,
    Species
}

interface IClickable {
    getClickableType(): ClickableType
}

class Helper {
    public static fieldType2Str(type: FieldType): string {
        switch (type) {
            case FieldType.Alpine: return "alpineMountain";
            case FieldType.Desert: return "desert";
            case FieldType.Forest: return "forest";
            case FieldType.Mountain: return "mountain";
            case FieldType.Swamp: return "swamp";
            case FieldType.Water: return "water";
        }
    }

    public static str2FieldType(type: string): FieldType | undefined {
        switch (type) {
            case this.fieldType2Str(FieldType.Alpine): return FieldType.Alpine;
            case this.fieldType2Str(FieldType.Desert): return FieldType.Desert;
            case this.fieldType2Str(FieldType.Forest): return FieldType.Forest;
            case this.fieldType2Str(FieldType.Mountain): return FieldType.Mountain;
            case this.fieldType2Str(FieldType.Swamp): return FieldType.Swamp;
            case this.fieldType2Str(FieldType.Water): return FieldType.Water;

            default: return undefined;
        }
    }

    public static getDescriptionOf(type: FieldType) {
        switch (type) {
            case FieldType.Alpine: return "Bei diesem Habitat handelt es sich um ein Hochgebirge mit geringer Sauerstoffkonzetration in der Luft und eisigen Temperaturen.\n\nHier findet sich nur noch wenig Nahrung, dafür aber Wasser.\n\nBegünstigt werden Mutationen, welche die Lungenatmung und die Anpassung an extreme Kälte fördern sowie das Klettern oder Fliegen.\n\nGehemmt werden Mutationen, welche das Sozialverhalten verbessern oder das Leben im Wasser erleichtern.";
            case FieldType.Desert: return "Bei diesem Habitat handelt es sich um eine ausgedörte Wüste mit hohen Temperaturschwankungen.\n\nHier finden sich weder gute Versteckmöglichkeiten noch Nahrungsquellen oder Wasser.\n\nBegünstigt werden Mutationen, welche die Landfortbewegung und die Anpassung an extreme Hitze fördern.\n\nGehemmt werden Mutationen, welche das Sozialverhalten verbessern.";
            case FieldType.Forest: return "Bei diesem Habitat handelt es sich um einen dichten Wald.\n\nEin solcher bietet gute Versteckmöglichkeiten sowie hervorragende Nahrungsquellen.\n\nBegünstigt werden Mutationen, die das Klettern und das Sozialverhalten fördern.\n\nGehemmt werden Mutationen, welche das Durchaltevermögen verbessern.";
            case FieldType.Mountain: return "Bei diesem Habitat handelt es sich um ein Gebirge mit eisigen Temperaturen.\n\nHier findet sich nur noch ausreichend Nahrung.\n\nBegünstigt werden Mutationen, welche die Lungenatmung, das Klettern oder Fliegen begünstigen.\n\nGehemmt werden Mutationen, welche das Sozialverhalten verbessern oder das Leben im Wasser erleichtern.";
            case FieldType.Swamp: return "Bei diesem Habitat handelt es sich um einen Sumpf mit moderaten Temperaturen.\n\nDieses Feld stellt eine Brücke zwischen Wasser- und Land-Habitaten dar. Zudem findet sich hier ausreichend Nahrung.\n\nBegünstigt werden Mutationen, welche sowohl die Lungenatmung als auch die Kiemenatmung fördern.\n\nGehemmt werden Mutationen, welche das Leben unter extremen Bedingungen erleichtern.";
            case FieldType.Water: return "Bei diesem Habitat handelt es sich um seichtes Wasser bis wenige Meter tiefe.\n\nEin solches bietet gute Versteckmöglichkeiten vor Landlebewesen, aber wenig Schutz vor schwimmenden Spezies. Allerdings sind die Nahrungsquellen reichhaltig.\n\nBegünstigt werden Mutationen, die das Schwimmen und das Ausbilden von Kiemen fördern.\n\nGehemmt werden Mutationen, welche die Lungenatmung oder die Landfortbewegung verbessern.";
        }
    }
}

class FieldChip extends Mesh implements IClickable {
    public type: FieldType;
    public species: SpeciesChip[] = [];
    public maxSpeciesCount = 5;

    constructor(name: string, type: FieldType, scene?: Scene, parent?: Node, mesh?: Mesh) {
        super(name, scene, parent, mesh);
        this.type = type;
    }

    public getClickableType(): ClickableType {
        return ClickableType.Field;
    }

    public getSurvivalRate(species: SpeciesChip): number {
        return species.mutation.calcBonusForField(this.type);
    }

    public getActiviyRate(species: SpeciesChip): number {
        return species.mutation.calcActivity(this.type);
    }

    public getAgression(species: SpeciesChip): number {
        return species.mutation.calcAgression(this.type);
    }

    public getReproductionRate(species: SpeciesChip): number {
        return species.mutation.calcReproduction(this.type);
    }

    public getDefense(species: SpeciesChip): number {
        return species.mutation.calcDefense(this.type);
    }

    public place(species: SpeciesChip, old: FieldChip | undefined = undefined, gh: IGameHandler | undefined = undefined, invoker: SotFController | undefined = undefined) {
        if (gh !== undefined && invoker !== undefined) {
            if (this.species.length == this.maxSpeciesCount) {
                return;
            }

            let alreadyOwned = false;
            this.species.forEach(s => alreadyOwned = alreadyOwned || s.owner.getName() == species.owner.getName());

            if (!alreadyOwned) {
                // calculate success if this is the call by the invoker:
                let activity = this.getActiviyRate(species);
                if (old !== undefined) {
                    activity *= 2;
                    activity += old.getActiviyRate(species);
                    activity /= 3.0;
                }

                if (Math.random() > activity * 0.6 + 0.34) {
                    // sorry the species won't move...
                    return;
                }

                let survival = this.getSurvivalRate(species);
                if (Math.random() > survival * 0.66 + 0.34) {
                    // sorry the species died...

                    gh.handle({
                        type: ActionType.Event,
                        invoker: invoker.getName(),
                        info: {
                            objectName: invoker.getName(),
                            evt: {
                                name: "died",
                                species: species.name
                            }
                        } as EventInfo
                    });

                    return;
                }
            }
        }
        
        if (old !== undefined) {
            let idx = old.species.findIndex((c) => c.name == species.name);
            old.species.slice(idx, 1);

            let i = 0;
            old.species.forEach(s => {
                s.position.y = 0.16 * i++;
                s.position.z = this.position.z;
                s.position.x = this.position.x;
            });
        }

        let idx = this.species.findIndex((c) => c.name == species.name);
        if(idx === undefined || idx < 0) {
            this.species.push(species);
            species.posessedField = this;
            species.position.y = 0.16 * this.species.length;
            species.position.z = this.position.z;
            species.position.x = this.position.x;
        }

        if (gh !== undefined && invoker !== undefined) {
            gh.handle({
                type: ActionType.Event,
                invoker: invoker.getName(),
                info: {
                    objectName: invoker.getName(),
                    evt: {
                        name: "place",
                        field: this.name,
                        species: species.name
                    }
                } as EventInfo
            });
        }
    }
}

interface IFieldProvider {
    getOrdered(): FieldChip[][];
    getPositionOrdered(chip: FieldChip): number[];
    getField(pos: number[]): FieldChip;
    getFieldFromSpecies(species: SpeciesChip): FieldChip;
    getNeighbours(chip: FieldChip): FieldChip[];
    getFieldByName(name: string): FieldChip;
    remove(species: SpeciesChip);
}

enum UnevolveType {
    Oldest,
    Newest,
    Unused
}

interface IMutationStats {
    mutation: Mutation;
    agression: number;
    activity: number;
    defense: number;
    reproduction: number;
    boni: Map<FieldType, number>;
    requires: string[];
}

class Mutation {
    protected decoratee: Mutation = undefined;
    protected stats: IMutationStats;
    public name: string;

    constructor(stats: IMutationStats) {
        this.stats = stats;
    }

    public getName(): string {
        return this.name;
    }

    public unapply(name: string = undefined, parent: Mutation = this): Mutation {
        if(name == undefined)
            return this.decoratee;

        if (this.getName() == name) {
            if (parent.getName() == this.getName()) {
                return this.decoratee;
            } else {
                parent.decoratee = this.decoratee;
                return parent;
            }
        } else {
            return this.decoratee.unapply(name, this);
        }
    }

    public apply(decoratee: Mutation): Mutation {
        let n = new Mutation(this.stats);
        if (decoratee !== undefined && decoratee.stats !== undefined && decoratee.name !== undefined)
            n.decoratee = decoratee;
        n.name = this.name;
        return n;
    }

    public getMutationList(): Mutation[] {
        let v = [];
        if (this.decoratee !== undefined) {
            v = this.decoratee.getMutationList();
        }
        v.push(this);

        return v;
    }

    public getMutationNames(): string[] {
        let list = [];
        this.getMutationList().forEach(m => list.push(m.getName()));
        return list;
    }

    public static load(): Promise<Mutation[]> {
        return new Promise<Mutation[]>((resolve, reject) => {
            fetch(window.location.pathname.substring(0, window.location.pathname.lastIndexOf("/")) + "/assets/infos/Mutations.json").then((res) => {
                res.json().then(j => {
                    let muts: Mutation[] = [];
                    (j as any[]).forEach(e => {
                        let stats: IMutationStats = {
                            activity: e.activity,
                            defense: e.defense,
                            agression: e.agression,
                            reproduction: e.reproduction,
                            boni: new Map<FieldType, number>(),
                            requires: (e.requires !== undefined) ? e.requires as string[] : []
                        } as IMutationStats;
                        for (var prop in e.boni) {
                            if (Object.prototype.hasOwnProperty.call(e.boni, prop)) {
                                let type = Helper.str2FieldType(prop);
                                if (type !== undefined) {
                                    stats.boni.set(type, e.boni[prop]);
                                }
                            }
                        } 
                        let mut = new Mutation(stats);
                        mut.name = e.name;
                        muts.push(mut);
                    });
                    resolve(muts);
                });
            });
        });
    }

    public calcShallowBonusForField(type: FieldType): number {
        if (this.stats.boni.has(type)) {
            return this.stats.boni.get(type);
        }

        return undefined;
    }

    public calcBonusForField(type: FieldType): number {
        if (this.stats === undefined) {
            return 0;
        }

        let sum = 0.0;
        let influencing = 0;
        this.getMutationList().forEach(element => {
            if (element.stats.boni.has(type)) {
                sum += element.stats.boni.get(type);
                influencing++;
            }
        });

        return Math.max((influencing > 0) ? sum / influencing : 0.0, 0.0);
    }

    public calcReproduction(type: FieldType): number {
        if (this.stats === undefined) {
            return 0;
        }

        let sum = 0.0;
        let influencing = 0;
        this.getMutationList().forEach(element => {
            if (element.stats.boni.has(type)) {
                sum += element.stats.boni.get(type) * element.stats.reproduction;
                influencing++;
            }
        });

        return Math.max((influencing > 0) ? sum / influencing : 0.0, 0.0);
    }

    public calcActivity(type: FieldType): number {
        if (this.stats === undefined) {
            return 0;
        }

        let sum = 0.0;
        let influencing = 0;
        this.getMutationList().forEach(element => {
            if (element.stats.boni.has(type)) {
                sum += element.stats.boni.get(type) * element.stats.activity;
                influencing++;
            }
        });

        return Math.max((influencing > 0) ? sum / influencing : 0.0, 0.0);
    }

    public calcDefense(type: FieldType): number {
        if (this.stats === undefined) {
            return 0;
        }

        let sum = 0.0;
        let influencing = 0;
        this.getMutationList().forEach(element => {
            if (element.stats.boni.has(type)) {
                sum += element.stats.boni.get(type) * element.stats.defense;
                influencing++;
            }
        });

        return Math.max((influencing > 0) ? sum / influencing : 0.0, 0.0);
    }

    public calcAgression(type: FieldType): number {
        if (this.stats === undefined) {
            return 0;
        }

        let sum = 0.0;
        let influencing = 0;
        this.getMutationList().forEach(element => {
            if (element.stats.boni.has(type)) {
                sum += element.stats.boni.get(type) * element.stats.agression;
                influencing++;
            }
        });

        return Math.max((influencing > 0) ? sum / influencing : 0.0, 0.0);
    }

    public Unevolve(type: UnevolveType, gh: GameHandler, con: SotFController) {
        let mut: Mutation;
        
        if(type == UnevolveType.Newest) {
            mut = this;
        } else {
            if (type == UnevolveType.Oldest) {
                mut = this.getMutationList()[0];
            } else {
                let result = {
                    val: 1,
                    mut: this as Mutation
                }
                let muts = this.getMutationList();
                muts.forEach(m => {
                    let v = 0;
                    con.getPosessedFieldTypes().forEach(t => {
                        let b = m.calcShallowBonusForField(t);
                        if (b !== undefined) {
                            v += b;
                        }
                    });
                    if (v < result.val) {
                        result.val = v;
                        result.mut = m;
                    }
                }); 

                mut = result.mut;
            }
        }

        gh.handle({
            type: ActionType.Event,
            invoker: "GameSetup",
            info: {
                objectName: con.getName(),
                evt: {
                    name: "unevolve",
                    mutation: mut.getName()
                }
            } as EventInfo
        });
    }

    public mutate(possessedFields: FieldType[], gh: GameHandler, con: SotFController, force: boolean = false) {
        Mutation.load().then((muts) => {
            let mutationsPresent = this.getMutationNames();
            let availiable: Mutation[] = [];
            muts.forEach(m => {
                if (!(m.getName() in mutationsPresent)) {
                    let sat: boolean = m.stats.requires.length == 0;
                    m.stats.requires.forEach(r => {
                        sat = sat || (r in mutationsPresent);
                    });
                    if(sat)
                        availiable.push(m);
                }
            });

            if(availiable.length == 0) {
                return;
            }

            let mut: Mutation;
            if (!force) {
                // calc if this will be mutated
                let chances = []
                for (let i = 0; i < availiable.length; i++) {
                    let v  = 0;
                    possessedFields.forEach(f => { v += availiable[i].calcBonusForField(f) });
                    chances.push({
                        prob: v,
                        idx: i
                    });
                }
                chances.sort((a,b) => a.prob - b.prob);

                let indices = [];
                indices.push(chances[0].idx);
                for(let i = 1; i < chances.length; i++) {
                    for(let j = 0; j < ((chances[0].prob > 0) ? chances[i].prob / chances[0].prob : 1); j++) {
                        indices.push(chances[i].idx);
                    }
                }
                mut = availiable[indices[Math.floor(Math.random() * indices.length)]];
            } else {
                mut = availiable[Math.floor(Math.random() * availiable.length)];
            }

            gh.handle({
                type: ActionType.Event,
                invoker: "GameSetup",
                info: {
                    objectName: con.getName(),
                    evt: {
                        name: "mutate",
                        mutation: mut.getName()
                    }
                } as EventInfo
            });
        });
    }
}

interface ISpeciesStats extends IMutationStats {
    mutation: Mutation;
}

class SpeciesChip extends Mesh implements ISpeciesStats, IClickable {
    public mutation: Mutation;
    public agression: number;
    public activity: number;
    public defense: number;
    public reproduction: number;
    public boni: Map<FieldType, number>;
    public requires: string[]
    public owner: SotFController;
    public posessedField: FieldChip;

    constructor(name: string, scene?: Scene, parent?: Node, mesh?: Mesh) {
        super(name, scene, parent, mesh);
        this.mutation = new Mutation(undefined);
    }

    public getClickableType(): ClickableType {
        return ClickableType.Species;
    }
}

class FieldFactory extends SpawnFactory {
    public cons: SotFController[] = [];
    public fieldProvider: IFieldProvider;

    public constructor(scene: Scene, cons: SotFController[], onFinished: () => void) {
        super(scene, onFinished);
        this.cons = cons;
    }

    public process(info: any): Promise<Mesh | undefined> {
        let spawnInfo = info as SpawnInfo;
        return new Promise<Mesh | undefined>((resolve, reject) => {
            let type: FieldType | undefined = Helper.str2FieldType(spawnInfo.objectClass);

            if (type !== undefined) {
                console.log("Spawn field: " + String(this.spawnedMeshes) + " of " + String(this.meshesToSpawn));
                SceneLoader.ImportMesh("", window.location.pathname.substring(0, window.location.pathname.lastIndexOf("/")) + "/assets/meshes/", "field_chip.obj", this.scene, (meshes) => {
                    let spawn = meshes[0] as Mesh;
                    spawn.visibility = 0;
                    
                    spawn = new FieldChip(spawnInfo.name, type, this.scene, undefined, meshes[0] as Mesh);
                    spawn.visibility = 1;
                    let mat = new StandardMaterial("", this.scene);
                    let url = window.location.pathname.substring(0, window.location.pathname.lastIndexOf("/")) + "/assets/textures/" + Helper.fieldType2Str(type) + ".png";
                    mat.diffuseColor = new Color3(1,1,1);
                    mat.specularColor = new Color3(1,1,1);
                    mat.diffuseTexture = new Texture(url, this.scene);
                    spawn.material = mat;
                    spawn.position = spawnInfo.position;
                    if (spawnInfo.rotation.w > 0 && new Vector3(spawnInfo.rotation.x, spawnInfo.rotation.y, spawnInfo.rotation.z).length() > 0)
                        spawn.rotate(new Vector3(spawnInfo.rotation.x, spawnInfo.rotation.y, spawnInfo.rotation.z), spawnInfo.rotation.w, Space.LOCAL);
                    resolve(spawn);
                }, (e) => {}, (scene, msg, e) => { 
                    console.log("Error on import mesh: " + msg);
                    reject();
                });
            } else {
                if (spawnInfo.objectClass == "SpeciesChip") {
                    let mesh = MeshBuilder.CreateCylinder(spawnInfo.name, {
                        diameterTop: 0.3,
                        diameter: 0.3,
                        height: 0.1,
                        enclose: true,
                        arc: 6,
                        subdivisions: 6,
                    }, this.scene);
                    let spawn = new SpeciesChip(spawnInfo.name, this.scene, undefined, mesh);
                    let mat = new StandardMaterial("", this.scene);
                    let color = spawnInfo.additional.color;
                    mat.diffuseColor = new Color3(color.r, color.g, color.b);
                    mat.specularColor = new Color3(1,1,1);
                    spawn.material = mat;
                    spawn.position = spawnInfo.position;
                    if (spawnInfo.rotation.w > 0 && new Vector3(spawnInfo.rotation.x, spawnInfo.rotation.y, spawnInfo.rotation.z).length() > 0)
                        spawn.rotate(new Vector3(spawnInfo.rotation.x, spawnInfo.rotation.y, spawnInfo.rotation.z), spawnInfo.rotation.w, Space.LOCAL);

                    let con = this.cons.find((c) => c.getName() == spawnInfo.additional.owner);
                    con.add2Species(spawn);
                    con.color = mat.diffuseColor;

                    if (spawnInfo.additional.field !== undefined) {
                        this.fieldProvider.getFieldByName(spawnInfo.additional.field).place(spawn);
                    }

                    resolve(spawn);
                } else {
                    reject();
                }
            }
        });
    }
}

export class SurvivalOfTheFittestGUI extends GameGUI {
    protected highlightLayer: HighlightLayer;
    protected strategyImg: Image;
    protected infoImg: Image;
    protected leftContainer: Rectangle;
    protected rightContainer: Rectangle;
    protected bottomContainer: Rectangle;
    protected infoText: TextBlock;
    protected survivalRateText: TextBlock;

    constructor(name: string, resolution: [number, number], scene: Scene) {
        super(name, resolution);
        this.highlightLayer = new HighlightLayer("hl1", scene);

        this.leftContainer = new Rectangle("leftContainer");
        this.leftContainer.width = 0.2;
        this.leftContainer.height = 0.95;
        this.leftContainer.thickness = 0;
        this.leftContainer.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
        this.leftContainer.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
        this.addControl(this.leftContainer);

        this.rightContainer = new Rectangle("rightContainer");
        this.rightContainer.width = 0.2;
        this.rightContainer.height = 0.8;
        this.rightContainer.thickness = 0;
        this.rightContainer.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
        this.rightContainer.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
        this.addControl(this.rightContainer);

        this.bottomContainer = new Rectangle("bottomContainer");
        this.bottomContainer.width = 1.0;
        this.bottomContainer.height = 0.25;
        this.bottomContainer.thickness = 0;
        this.bottomContainer.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
        this.bottomContainer.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
        this.addControl(this.bottomContainer);

        this.strategyImg = new Image("strategyImg");
        this.strategyImg.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
        this.strategyImg.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
        this.strategyImg.width = 0.3;
        this.strategyImg.height = 0.3;
        this.strategyImg.stretch = Image.STRETCH_UNIFORM;
        this.leftContainer.addControl(this.strategyImg);

        this.infoImg = new Image("infoImg");
        this.infoImg.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
        this.infoImg.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
        this.infoImg.width = 1;
        this.infoImg.height = 0.5;
        this.infoImg.stretch = Image.STRETCH_UNIFORM;
        this.rightContainer.addControl(this.infoImg);

        this.infoText = new TextBlock("infoText");
        this.infoText.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
        this.infoText.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
        this.infoText.width = 0.65;
        this.infoText.textWrapping = TextWrapping.WordWrap;
        this.infoText.height = 0.5;
        this.infoText.zIndex = 2;
        this.infoText.top = "34px";
        this.infoText.text = "";
        this.infoText.fontFamily = "Ceviche One";
        this.infoText.fontSize = "14px";
        this.infoText.color = "white";
        this.rightContainer.addControl(this.infoText);

        this.survivalRateText = new TextBlock("survivalRateText");
        this.survivalRateText.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
        this.survivalRateText.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
        this.survivalRateText.width = 0.65;
        this.infoText.textWrapping = TextWrapping.WordWrap;
        this.survivalRateText.height = 0.5;
        this.survivalRateText.zIndex = 2;
        this.survivalRateText.text = "";
        this.survivalRateText.fontFamily = "Ceviche One";
        this.survivalRateText.fontSize = "24px";
        this.survivalRateText.color = "white";
        this.rightContainer.addControl(this.survivalRateText);
    }

    public updateFromPlayer(p: SotFController) {
        if(p.getStrategy() == SpeciesStrategy.R) {
            this.strategyImg.source = window.location.pathname.substring(0, window.location.pathname.lastIndexOf("/")) + "/assets/textures/StratR.jpg";
        } else {
            this.strategyImg.source = window.location.pathname.substring(0, window.location.pathname.lastIndexOf("/")) + "/assets/textures/StratK.jpg";
        }

        let s = p.getSpecies();
        this.bottomContainer.clearControls();
        if (s !== undefined) {
            let muts = s.mutation.getMutationList();
            let i = 0;
            muts.forEach(element => {
                let img = new Image(undefined, window.location.pathname.substring(0, window.location.pathname.lastIndexOf("/")) + "/assets/textures/Mutations/" + element.getName() + ".png");
                img.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
                img.verticalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
                img.width = 0.2;
                img.height = 0.6;
                img.left = String((i - muts.length / 2) * 10) + "%";
                img.stretch = Image.STRETCH_UNIFORM;
                this.bottomContainer.addControl(img);

                let txt = new TextBlock(undefined, element.getName().replace("_", " "));
                txt.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
                txt.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
                txt.width = "10%";
                txt.textWrapping = TextWrapping.WordWrap;
                txt.height = 0.5;
                txt.zIndex = 2;
                txt.top = "-16%";
                txt.left = String((i - muts.length / 2) * 10) + "%";
                txt.fontFamily = "Ceviche One";
                txt.fontSize = "20px";
                txt.color = "white";
                this.bottomContainer.addControl(txt);
                i++;
            });
        }
    }

    public highlight(m: IClickable, color: Color3, highlightOnly: boolean = false) {
        if(!highlightOnly) {
            this.highlightLayer.removeAllMeshes();
            this.showInfos(undefined);
        }
        if (m !== undefined) {
            this.highlightLayer.addMesh((m as any) as Mesh, color);

            if(!highlightOnly)
                this.showInfos(m);
        }
    }

    public showInfos(m: IClickable) {
        if (m == undefined) {
            this.infoImg.isVisible = false;
            this.infoText.text = "";
            this.survivalRateText.text = "";
        } else {
            if (m.getClickableType() == ClickableType.Field) {
                this.infoImg.source = window.location.pathname.substring(0, window.location.pathname.lastIndexOf("/")) + "/assets/textures/" + Helper.fieldType2Str((m as FieldChip).type) + "Info.png";
                this.infoImg.isVisible = true;
                this.infoText.text = Helper.getDescriptionOf((m as FieldChip).type);
                this.survivalRateText.text = "Überlebensbonus: " + String(Math.round(((m as any) as FieldChip).getSurvivalRate(this.owner.getSpecies()) * 100)) + "%";
                this.survivalRateText.text += "\n\nFortpflanzungsrate: " + String(Math.round(((m as any) as FieldChip).getReproductionRate(this.owner.getSpecies()) * 100)) + "%";
                this.survivalRateText.text += "\n\nAktivität: " + String(Math.round(((m as any) as FieldChip).getActiviyRate(this.owner.getSpecies()) * 100)) + "%";
                this.survivalRateText.text += "\n\nVerteidigung: " + String(Math.round(((m as any) as FieldChip).getDefense(this.owner.getSpecies()) * 100)) + "%";
                this.survivalRateText.text += "\n\nAgression: " + String(Math.round(((m as any) as FieldChip).getAgression(this.owner.getSpecies()) * 100)) + "%";
            }
        }     
    }

    public owner: SotFPlayer;
}

enum SpeciesStrategy {
    R = 0,
    K
}

abstract class SotFController extends Controller {
    protected strategy: SpeciesStrategy;
    protected speciesChips: SpeciesChip[] = [];
    public color: Color3;
    protected fieldProvider: IFieldProvider;

    constructor(account: SVEAccount | string, gh: IGameHandler, fieldProvider: IFieldProvider) {
        super(account, gh);
        this.fieldProvider = fieldProvider;       
    }

    public getPosessedFieldTypes(): FieldType[] {
        let list = [];
        this.speciesChips.forEach(s => {
            if(s.posessedField == undefined) {
                s.posessedField = this.fieldProvider.getFieldFromSpecies(s);
            }

            if (!(s.posessedField.type in list)) 
                list.push(s.posessedField.type);
        });

        return list;
    }

    public getSpecies(n: number = 0): SpeciesChip {
        return this.speciesChips[n];
    }

    public getSpeciesSize(): number {
        return this.speciesChips.length;
    }

    public onEvent(evt: any): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            if (evt.name !== undefined) {
                if (evt.name == "mutate") {
                    Mutation.load().then((muts) => {
                        let mut = muts.find((m) => m.getName() == evt.mutation);
                        this.speciesChips.forEach(sc => {
                            sc.mutation = mut.apply(sc.mutation);
                        });
                        resolve();
                    });
                } else {
                    if (evt.name == "place") {
                        let species = this.speciesChips.find(s => s.name == evt.species);
                        let currentField = this.fieldProvider.getFieldFromSpecies(species);
                        let newField = this.fieldProvider.getFieldByName(evt.field);
                        newField.place(species, currentField);
                    }

                    if (evt.name == "died") {
                        let species = this.speciesChips.find(s => s.name == evt.species);
                        this.speciesChips = this.speciesChips.filter(s => s.name != evt.species);
                        this.fieldProvider.remove(species);
                    }

                    if(evt.name == "unevolve") {
                        console.log("On unevolve: ", this.speciesChips[0].mutation.getMutationNames());
                        this.speciesChips.forEach(sc => {
                            let mut = sc.mutation;
                            if (mut.name == evt.mutation) {
                                mut = mut.unapply();
                            } else {
                                mut = mut.unapply(evt.mutation);
                            }
                            
                            if (mut !== undefined)
                                sc.mutation = mut;
                        });
                        console.log("On unevolve finish: ", this.speciesChips[0].mutation.getMutationNames());
                    }
                    resolve();
                }
            } else {
                resolve();
            }
        });   
    }

    public setStrategy(s: SpeciesStrategy) {
        this.gameHandler.handle({
            info: {
                objectName: this.getName(),
                field: {
                    name: "strategy",
                    value: s
                }
            } as UpdateInfo,
            invoker: this.getInvokerName(),
            type:ActionType.Update
        });
    }

    public getStrategy(): SpeciesStrategy {
        return this.strategy;
    }

    public add2Species(s: SpeciesChip) {
        this.speciesChips.push(s);
        s.owner = this;
    }

    protected abstract getInvokerName(): string;
}

export class SotFPlayer extends SotFController {
    protected onRoundEnd: (value: Controller | PromiseLike<Controller>) => void = (x) => {};
    protected onRoundEndAbort: (reason?: any) => void = (x) => {};
    protected gui: SurvivalOfTheFittestGUI;
    protected selectedFields: IClickable[] = [];
    
    protected getInvokerName(): string {
        return "Self";
    }

    public invoke(): Promise<Controller> {
        return new Promise<Controller>((resolve, reject) => {
            this.selectedFields = [];
            this.onRoundEnd = resolve;
            this.onRoundEndAbort = reject;
        });
    }

    protected getOwnedSpeciesNames(): string[] {
        let names: string[] = [];

        this.speciesChips.forEach(element => {
            names.push(element.name);
        });

        return names;
    }

    public isChipOwned(species: SpeciesChip): boolean {
        let owned = false;
        this.speciesChips.forEach(element => {
            owned = owned || element.name == species.name;
        });
        return owned;
    }

    protected finishRound() {
        console.log("Finish players round");
        let end = this.onRoundEnd;
        this.onRoundEnd = (x) => {};
        this.onRoundEndAbort = (x) => {};
        end(this); 
    }

    public onInput(evt: PointerEvent, pickInfo: PickingInfo) {
        this.gui.highlight(undefined, this.color);
        setTimeout(() => {
            this.finishRound();
        }, 7000);
        if(pickInfo.pickedMesh !== null) {
            if (((pickInfo.pickedMesh as any) as IClickable).getClickableType !== undefined) {
                this.selectedFields.push((pickInfo.pickedMesh as any) as IClickable);
                this.gui.highlight(((pickInfo.pickedMesh as any) as IClickable), this.color);             
            } else {
                this.selectedFields = [];
            }
        } else {
            this.selectedFields = [];
        }

        if (this.selectedFields.length > 1) {
            if (this.selectedFields[1].getClickableType() == ClickableType.Species) {
                if (this.selectedFields[0].getClickableType() == ClickableType.Species && ((this.selectedFields[0] as any) as SpeciesChip).name == ((this.selectedFields[0] as any) as SpeciesChip).name) {
                    this.selectedFields = [];
                    this.finishRound();
                } else {
                    this.selectedFields = [this.selectedFields[1]];
                }
            }
        }

        if (this.selectedFields.length > 0) {
            if (this.selectedFields[0].getClickableType() == ClickableType.Species) {             
                if (!this.isChipOwned((this.selectedFields[0] as any) as SpeciesChip)) {
                    this.selectedFields = [];
                    this.gui.highlight(undefined, this.color);
                    return;
                }

                let currentField = this.fieldProvider.getFieldFromSpecies(
                    ((this.selectedFields[0] as any) as SpeciesChip)
                );
                let neighbours = this.fieldProvider.getNeighbours(currentField);
                neighbours.forEach(n => {
                    this.gui.highlight(n, this.color, true);
                });

                if (this.selectedFields.length > 1) {
                    if (this.selectedFields[1].getClickableType() == ClickableType.Field) {
                        let inRange = false;
                        neighbours.forEach(n => {
                            inRange = inRange || n.name == ((this.selectedFields[1] as any) as FieldChip).name;
                        });
                        if (inRange) {
                            ((this.selectedFields[1] as any) as FieldChip).place(
                                (this.selectedFields[0] as any) as SpeciesChip,
                                currentField,
                                this.gameHandler,
                                this
                            );

                            this.finishRound();
                        }
                        this.selectedFields = [];
                        this.gui.highlight(undefined, this.color);
                    }
                }
            }
        }
    }

    public onEvent(evt: any): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            super.onEvent(evt).then(() => {
                (this.gui as SurvivalOfTheFittestGUI).updateFromPlayer(this);
                resolve();
            });
        });
    }

    constructor(account: SVEAccount, gui: SurvivalOfTheFittestGUI, gh: IGameHandler, fieldProvider: IFieldProvider) {
        super(account, gh, fieldProvider);
        this.gui = gui;
        this.gui.owner = this;
    }   
}

export class SotFAIController extends SotFController {
    protected strategy: SpeciesStrategy;

    public invoke(): Promise<Controller> {
        return new Promise<Controller>((resolve, reject) => {
            setTimeout(() => {
                let s = this.speciesChips[Math.floor(Math.random() * this.speciesChips.length)];
            
                let move = (Math.random() >= 0.5);
                
                if (move) {
                    let cf = this.fieldProvider.getFieldFromSpecies(s);
                    let ns = this.fieldProvider.getNeighbours(cf);
                    let des = {
                        rate: 0,
                        field: undefined
                    };
                    ns.forEach(n => {
                        let rate = n.getSurvivalRate(s);
                        if (des.rate == undefined || des.rate < rate) {
                            des.field = n;
                            des.rate = rate;
                        }
                    });

                    if (des.field !== undefined) {
                        (des.field as FieldChip).place(
                            s, cf, this.gameHandler, this
                        );
                    }
                }
                resolve(this);
            }, 1500);   
        });
    }

    protected getInvokerName(): string {
        return this.getName();
    }

    constructor(account: string, gh: IGameHandler, fieldProvider: IFieldProvider) {
        super(account, gh, fieldProvider);
        this.ready = true;
    }
}

export class SurvivalOfTheFittestGame extends GameScene implements IFieldProvider {
    private chips: FieldChip[];
    private assetsManager: AssetsManager;
    
    private species_count: number;
    private field_size: number = 10;
    private light: HemisphericLight;

    public getOrdered(): FieldChip[][] {
        let list: FieldChip[][] = [];
        for(let i = 0; i < this.field_size; i++) {
            let subList: FieldChip[] = [];
            for(let j = 0; j < this.field_size; j++) 
                subList.push(this.chips[(i * this.field_size) + j]);
            list.push(subList);
        }
        return list;
    }

    public getField(pos: number[]): FieldChip {
        return this.getOrdered()[pos[0]][pos[1]];
    }

    public remove(species: SpeciesChip) {
        this.chips.forEach(c => {
            c.species = c.species.filter(s => s.name != species.name);
        });
        species.visibility = 0;
        species.dispose();
    }

    public getFieldByName(name: string): FieldChip {
        return this.chips.find(c => c.name == name);
    }

    public getFieldFromSpecies(species: SpeciesChip): FieldChip {
        let result: {
            dist: number | undefined,
            field: FieldChip
        } = {
            dist: undefined,
            field: undefined
        };
        this.chips.forEach(fc => {
            let distance = fc.position.subtract(species.position).length();
            if (result.dist === undefined || distance < result.dist) {
                result.field = fc;
                result.dist = distance;
            }
        });

        return result.field;
    }

    public getPositionOrdered(chip: FieldChip): number[] {
        return [
            Math.round(chip.position.x / 0.85) + (this.field_size / 2),
            Math.floor((Math.round(chip.position.x / 0.85) % 2 == 0) ? chip.position.z : (chip.position.z - 0.5)) + (this.field_size / 2)
        ];
    }

    public getNeighbours(chip: FieldChip): FieldChip[] {
        let list: FieldChip[] = [];
        this.chips.forEach(fc => {
            let diff = fc.position.subtract(chip.position);
            if (diff.length() > 0.0 && diff.length() <= 1.17583) {
                list.push(fc);
            }
        });
        return list;
    }

    constructor(name: string, engine: Engine, options?: SceneOptions) {
        super(name, engine, options);
        this.assetsManager = new AssetsManager(this);
        this.assetsManager.autoHideLoadingUI = false;
        this.light = new HemisphericLight("HemiLight", new Vector3(0, 1, 0), this);
        this.light.setEnabled(true);
    }

    protected buildGameField() {
        this.createDefaultCameraOrLight(true, true, true);
        this.createDefaultEnvironment();
        this.camera = this.activeCamera;

        if (this.gameHandler.getRole() != HandlerRole.Host) {
            return;
        }

        this.activeCamera.position = new Vector3(5, 5, 0);
        (this.activeCamera as ArcRotateCamera).setTarget(Vector3.Zero());

        this.gameHandler.handle({
            type: ActionType.Update,
            invoker: "GameSetup",
            info: {
                objectName: "SpawnFactory",
                field: {
                    name: "spawnedMeshes",
                    value: 0
                }
            } as UpdateInfo
        });

        this.gameHandler.handle({
            type: ActionType.Update,
            invoker: "GameSetup",
            info: {
                objectName: "SpawnFactory",
                field: {
                    name: "meshesToSpawn",
                    value: this.field_size * this.field_size
                }
            } as UpdateInfo
        });

        for(let i = 0; i < this.field_size; i++) {
            for(let j = 0; j < this.field_size; j++) {
                let type = Math.floor(Math.random() * 6) as FieldType;
                this.gameHandler.handle({
                    type: ActionType.Spawn,
                    invoker: "GameSetup",
                    info: {
                        name: "FieldChip" + String(i) + "_" + String(j),
                        objectClass: Helper.fieldType2Str(type),
                        position: new Vector3(-(this.field_size / 2) + (j * 0.85), 0, (j % 2 == 0) ? i - (this.field_size / 2) : i - ((this.field_size / 2) + 0.5)),
                        scale: new Vector3(1),
                        rotation: new Vector4(0, 0, 0, 0)
                    } as SpawnInfo
                });
            }
        }
    }

    public defineStartPos() {
        if (this.gameHandler.getRole() != HandlerRole.Host) {
            return;
        }

        let colors = [
            {
                r: 1,
                g: 0,
                b: 0
            },
            {
                r: 1,
                g: 1,
                b: 0
            },
            {
                r: 0,
                g: 1,
                b: 0
            },
            {
                r: 1,
                g: 0,
                b: 1
            },
            {
                r: 0,
                g: 0,
                b: 1
            },
            {
                r: 0,
                g: 1,
                b: 1
            },
            {
                r: 0,
                g: 0,
                b: 0
            },
            {
                r: 1,
                g: 1,
                b: 1
            },
            {
                r: 0.4,
                g: 0,
                b: 0.4
            },
            {
                r: 0.8,
                g: 0.2,
                b: 0
            }
        ];

        let cons = this.gameHandler.getControllers() as SotFController[];
        let idxes: number[] = [];
        for(let i = 0; i < this.species_count; i++) {
            let idx = Math.floor(Math.random() * this.chips.length);
            while(idx in idxes) {
                idx = Math.floor(Math.random() * this.chips.length);
            }
            idxes.push(idx);
            let target = this.chips[idx];
            let posX = target.position.x;
            let posY = target.position.z;
            let z = 0.16;
            let color_idx = Math.floor(Math.random() * colors.length);
            let color = colors[color_idx];
            colors.splice(color_idx, 1);
            this.gameHandler.handle({
                type: ActionType.Spawn,
                invoker: "GameSetup",
                info: {
                    name: "SpeciesChip" + String(i) + "_1",
                    objectClass: "SpeciesChip",
                    position: new Vector3(posX, z, posY),
                    scale: new Vector3(1),
                    rotation: new Vector4(0, 0, 0, 0),
                    additional: {
                        color: color,
                        owner: cons[i].getName()
                    }
                } as SpawnInfo
            });
            this.gameHandler.handle({
                type: ActionType.Spawn,
                invoker: "GameSetup",
                info: {
                    name: "SpeciesChip" + String(i) + "_2",
                    objectClass: "SpeciesChip",
                    position: new Vector3(posX, z * 2, posY),
                    scale: new Vector3(1),
                    rotation: new Vector4(0, 0, 0, 0),
                    additional: {
                        color: color,
                        owner: cons[i].getName()
                    }
                } as SpawnInfo
            });

            cons[i].getSpecies().mutation.mutate([], this.gameHandler, cons[i], true);
            cons[i].getSpecies().mutation.mutate([], this.gameHandler, cons[i], true);
        }

        setInterval(this.eventLoop.bind(this), 5000);

        let next = this.gameHandler.getControllers()[Math.floor(Math.random() * this.gameHandler.getControllers().length)] as SotFController;
        console.log("Start player: ", next.getName());
        this.gameHandler.handle({
            type: ActionType.InvokeController,
            invoker: "GameSetup",
            info: {
                controller: next.getName()
            } as InvokeControllerInfo
        });
    }

    protected eventLoop() {
        let cons = this.gameHandler.getControllers() as SotFController[];
        
        cons.forEach(c => {
            if (Math.random() > 0.95) {
                c.getSpecies().mutation.mutate(c.getPosessedFieldTypes(), this.gameHandler, c)
            
                if (Math.random() > Math.max(0.0, Math.min(1.0, 1.5 - c.getSpecies().mutation.getMutationNames().length / 8.0))) {
                    c.getSpecies().mutation.Unevolve(UnevolveType.Unused, this.gameHandler, c);
                }
            }
        });

        
        // try breed
        cons.forEach(c => {
            let s = c.getSpecies(Math.floor(Math.random() * c.getSpeciesSize()));
            let field = this.getFieldFromSpecies(s);
            if (Math.random() < field.getReproductionRate(s)) {
                let ownedSpeciesCount = 0;
                field.species.forEach(fs => (fs.owner.getName() == c.getName()) ? ownedSpeciesCount++ : ownedSpeciesCount);
                if (field.species.length < field.maxSpeciesCount && (ownedSpeciesCount > 2 || Math.random() > 0.5)) {
                    this.addSpeciesChipTo(c, field);
                }
            }
        });
    }

    protected addSpeciesChipTo(con: SotFController, field: FieldChip) {
        this.gameHandler.handle({
            type: ActionType.Spawn,
            invoker: "GameSetup",
            info: {
                name: "SpeciesChip_" + con.getName() + "_" + String(con.getSpeciesSize() + 1),
                objectClass: "SpeciesChip",
                position: new Vector3(0, 0, 0),
                scale: new Vector3(1),
                rotation: new Vector4(0, 0, 0, 0),
                additional: {
                    color: con.color,
                    owner: con.getName(),
                    field: field.name
                }
            } as SpawnInfo
        });
    }

    public init(gh: GameHandler) {
        super.init(gh);
        gh.getMetaInfos().then(meta => {
            this.metaGameInfo = meta;
            this.species_count = Number(meta.species_count);
            this.gui = new SurvivalOfTheFittestGUI("SotF_GUI", [1920, 1080], this);
            gh.addUpdateEventListener(this.onUpdateEntity.bind(this));
        });
    }

    protected onUpdateEntity(target: any, update: UpdateInfo) {
        console.log("On update: ", update);
        if (update.objectName == this.gameHandler.getLocalPlayerName()) {
            //update GUI
            (this.gui as SurvivalOfTheFittestGUI).updateFromPlayer(target as SotFController);
        }
    }

    public load(): Promise<GameScene> {
        this.chips = [];
        return new Promise<GameScene>((resolve, reject) => {
            this.gameHandler.spawnFactory = new FieldFactory(this, this.gameHandler.getControllers() as SotFController[], () => {
                this.defineStartPos();
                super.load().then(() => resolve(this), (err) => reject(err));
            });
            (this.gameHandler.spawnFactory as FieldFactory).fieldProvider = this;
            let player = new SotFPlayer(new SVEAccount({name: "Player", sessionID: "", loginState: LoginState.LoggedInByUser, id: 0} as SessionUserInitializer), this.gui as SurvivalOfTheFittestGUI, this.gameHandler, this);
            this.gameHandler.addController(player);
            player.setStrategy(SpeciesStrategy.R);
            this.onPointerDown = player.onInput.bind(player);
            for(let i = 1; i < this.species_count; i++) {
                let ai = new SotFAIController("AIPlayer" + String(i), this.gameHandler, this);
                this.gameHandler.addController(ai);
                ai.setStrategy(SpeciesStrategy.R);
            }
            this.gameHandler.addSpawnEventListener((spawn: Mesh) => {
                if (((spawn as any) as IClickable).getClickableType !== undefined) {
                    if (((spawn as any) as IClickable).getClickableType() == ClickableType.Field)
                        this.chips.push(spawn as FieldChip);
                } else {
                    if (((spawn as any) as SotFController).account !== undefined && ((spawn as any) as SotFController).getStrategy !== undefined && ((spawn as any) as SotFController).add2Species !== undefined) {
                        this.gameHandler.addController((spawn as any) as SotFController);
                    }
                }
            });

            this.buildGameField();
        });
    }
}