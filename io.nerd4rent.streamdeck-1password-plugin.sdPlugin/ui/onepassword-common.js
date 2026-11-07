const streamDeckClient = SDPIComponents.streamDeckClient;
const accountDetails = document.getElementById("account");
const accountField = document.getElementById("accountName");
const accountHint = document.getElementById("accountHint");
const accountNote = document.getElementById("accountNote");
const accountError = document.getElementById("accountError");
const itemSettings = document.getElementById("itemSettings");
const vault = document.getElementById("vault");
const item = document.getElementById("item");

const ACCOUNT_CHANGE_DEBOUNCE_MS = 600;
let knownAccountName;
let vaultsError = "";
let accountJustChanged = false;

function render() {
    const configured = Boolean(knownAccountName);
    const showError = configured && Boolean(vaultsError);
    itemSettings.hidden = !configured;
    accountHint.hidden = configured;
    accountNote.hidden = !configured;
    accountError.hidden = !showError;
    accountError.textContent = showError ? vaultsError : "";
    if (!configured || showError) {
        accountDetails.open = true;
    }
}

streamDeckClient.getGlobalSettings().then((settings) => {
    knownAccountName = settings.accountName || "";
    render();
});

streamDeckClient.sendToPropertyInspector.subscribe((message) => {
    if (message.payload?.event !== "getVaults") {
        return;
    }
    vaultsError = accountJustChanged ? message.payload.error || "" : "";
    accountJustChanged = false;
    if (knownAccountName !== undefined) {
        render();
    }
});

let accountChangeTimer;
accountField.addEventListener("valuechange", () => {
    clearTimeout(accountChangeTimer);
    accountChangeTimer = setTimeout(() => {
        const accountName = accountField.value || "";
        if (accountName === knownAccountName) {
            return;
        }
        knownAccountName = accountName;
        vaultsError = "";
        accountJustChanged = true;
        render();
        if (accountName) {
            vault.refresh();
        }
    }, ACCOUNT_CHANGE_DEBOUNCE_MS);
});

vault.addEventListener("valuechange", () => {
    setTimeout(() => item.refresh(), 0);
});
