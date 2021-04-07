import { ILoadingScreen, DefaultLoadingScreen } from "@babylonjs/core";

export class SVELoadingScreen extends DefaultLoadingScreen {
  constructor(decoratee: DefaultLoadingScreen) {
    super((decoratee as any)["_renderingCanvas"], (decoratee as any)["_loadingText"], (decoratee as any)["_loadingDivBackgroundColor"]);
    SVELoadingScreen.DefaultLogoUrl = "/assets/textures/SVE_Logo.png";
    DefaultLoadingScreen.DefaultLogoUrl = SVELoadingScreen.DefaultLogoUrl;
  }
}