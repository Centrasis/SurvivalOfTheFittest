import { ILoadingScreen, DefaultLoadingScreen } from "@babylonjs/core";

export class SVELoadingScreen extends DefaultLoadingScreen {
  constructor(decoratee: DefaultLoadingScreen) {
    super((decoratee as any)["_renderingCanvas"], (decoratee as any)["_loadingText"], (decoratee as any)["_loadingDivBackgroundColor"]);
    SVELoadingScreen.DefaultLogoUrl = window.location.pathname.substring(0, window.location.pathname.lastIndexOf("/")) + "/assets/textures/SVE_Logo.png";
    DefaultLoadingScreen.DefaultLogoUrl = SVELoadingScreen.DefaultLogoUrl;
  }
}