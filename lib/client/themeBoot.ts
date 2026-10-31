// Sem "use client": o script roda antes da hidratação, para o app não piscar no tema errado.

export const THEME_KEY = "concord:theme";
export const LEGACY_BLACK_KEY = "concord:black-background";

export const THEME_BOOT_SCRIPT = `try{var t=localStorage.getItem(${JSON.stringify(THEME_KEY)});if(t!=="beige"&&t!=="default"&&t!=="black")t=localStorage.getItem(${JSON.stringify(LEGACY_BLACK_KEY)})==="1"?"black":"default";document.documentElement.dataset.theme=t}catch(e){document.documentElement.dataset.theme="default"}`;
