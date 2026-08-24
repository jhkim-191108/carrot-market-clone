// 공통 모달. alert/confirm 대신 씀
function ensureAppModal() {
    let overlay = document.querySelector("#appModal");
    if (overlay) {
        return overlay;
    }

    overlay = document.createElement("div");
    overlay.id = "appModal";
    overlay.className = "app-modal";
    overlay.hidden = true;

    const box = document.createElement("div");
    box.className = "app-modal-box";
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-modal", "true");
    box.setAttribute("aria-labelledby", "appModalMessage");

    const messageEl = document.createElement("p");
    messageEl.className = "app-modal-message";
    messageEl.id = "appModalMessage";

    const actions = document.createElement("div");
    actions.className = "app-modal-actions";

    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "app-modal-cancel";
    cancel.textContent = "취소";

    const ok = document.createElement("button");
    ok.type = "button";
    ok.className = "app-modal-ok";
    ok.textContent = "확인";

    actions.append(cancel, ok);
    box.append(messageEl, actions);
    overlay.append(box);

    if (document.body) {
        document.body.append(overlay);
    } else {
        document.addEventListener("DOMContentLoaded", () => {
            document.body.append(overlay);
        });
    }

    return overlay;
}

function openAppModal(message, { showCancel }) {
    const overlay = ensureAppModal();
    const text = overlay.querySelector("#appModalMessage");
    const ok = overlay.querySelector(".app-modal-ok");
    const cancel = overlay.querySelector(".app-modal-cancel");

    return new Promise((resolve) => {
        text.textContent = message;
        cancel.hidden = !showCancel;
        overlay.hidden = false;

        const finish = (result) => {
            overlay.hidden = true;
            ok.removeEventListener("click", onOk);
            cancel.removeEventListener("click", onCancel);
            overlay.removeEventListener("click", onOverlay);
            resolve(result);
        };

        const onOk = () => finish(true);
        const onCancel = () => finish(false);
        const onOverlay = (event) => {
            if (event.target === overlay) {
                finish(!showCancel);
            }
        };

        ok.addEventListener("click", onOk);
        cancel.addEventListener("click", onCancel);
        overlay.addEventListener("click", onOverlay);
        ok.focus();
    });
}

function appAlert(message) {
    return openAppModal(message, { showCancel: false });
}

function appConfirm(message) {
    return openAppModal(message, { showCancel: true });
}
