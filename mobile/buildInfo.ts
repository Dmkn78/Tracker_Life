declare const __MOBILE_BUILD_VERSION__: string;
declare const __MOBILE_BUILD_TIME__: string;
export const MOBILE_BUILD_VERSION = typeof __MOBILE_BUILD_VERSION__ === "string" ? __MOBILE_BUILD_VERSION__ : "development";
export const MOBILE_BUILD_TIME = typeof __MOBILE_BUILD_TIME__ === "string" ? __MOBILE_BUILD_TIME__ : "";
