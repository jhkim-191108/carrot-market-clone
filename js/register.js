// 회원가입. 닉네임 필수, 아이디 칸 값은 API email로 전송
const registerForm = document.querySelector("#registerForm");
const userIdInput = document.querySelector("#userId");
const nicknameInput = document.querySelector("#nickname");
const checkEmailBtn = document.querySelector("#checkEmailBtn");
const emailCheckMsg = document.querySelector("#emailCheckMsg");
const passwordInput = document.querySelector("#password");
const passwordMsg = document.querySelector("#passwordMsg");
const passwordConfirmInput = document.querySelector("#passwordConfirm");
const passwordConfirmMsg = document.querySelector("#passwordConfirmMsg");

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_RULES = [
    { check: (value) => value.length >= 8, label: "8자 이상" },
    { check: (value) => /[A-Z]/.test(value), label: "영문 대문자" },
    { check: (value) => /[a-z]/.test(value), label: "영문 소문자" },
    { check: (value) => /[0-9]/.test(value), label: "숫자" },
    { check: (value) => /[^A-Za-z0-9]/.test(value), label: "특수문자" },
];

let checkedEmail = "";

function setEmailMessage(text, state) {
    emailCheckMsg.textContent = text;
    emailCheckMsg.classList.remove("is-ok", "is-error");
    if (state) {
        emailCheckMsg.classList.add(state);
    }
}

function setFieldMessage(element, text, state) {
    element.textContent = text;
    element.classList.remove("is-ok", "is-error");
    if (state) {
        element.classList.add(state);
    }
}

function getMissingPasswordRules(value) {
    return PASSWORD_RULES
        .filter((rule) => !rule.check(value))
        .map((rule) => rule.label);
}

function isPasswordValid(value) {
    return getMissingPasswordRules(value).length === 0;
}

function updatePasswordMessage() {
    const value = passwordInput.value;
    if (!value) {
        setFieldMessage(passwordMsg, "");
        return;
    }

    const missing = getMissingPasswordRules(value);
    if (missing.length === 0) {
        setFieldMessage(passwordMsg, "");
        return;
    }

    setFieldMessage(passwordMsg, `${missing.join(", ")}가 필요합니다.`, "is-error");
}

function updatePasswordConfirmMessage() {
    const confirmValue = passwordConfirmInput.value;
    if (!confirmValue) {
        setFieldMessage(passwordConfirmMsg, "");
        return;
    }

    if (confirmValue !== passwordInput.value) {
        setFieldMessage(passwordConfirmMsg, "비밀번호가 일치하지 않습니다.", "is-error");
        return;
    }

    setFieldMessage(passwordConfirmMsg, "");
}

function resetEmailCheck() {
    checkedEmail = "";
}

// 회원가입 버튼: 이메일 → 닉네임 → 비밀번호 → 비밀번호 확인 순으로 첫 오류에서 멈춤
async function validateSignupForm() {
    const email = userIdInput.value.trim();
    const nickname = nicknameInput.value.trim();
    const password = passwordInput.value;
    const passwordConfirm = passwordConfirmInput.value;

    if (!email) {
        setEmailMessage("이메일을 입력해주세요.", "is-error");
        await appAlert("이메일을 입력해주세요.");
        userIdInput.focus();
        return null;
    }

    if (!EMAIL_PATTERN.test(email)) {
        setEmailMessage("올바른 이메일 형식이 아닙니다.", "is-error");
        await appAlert("올바른 이메일 형식이 아닙니다.");
        userIdInput.focus();
        return null;
    }

    if (email !== checkedEmail) {
        setEmailMessage("이메일 중복확인을 해주세요.", "is-error");
        await appAlert("이메일 중복확인을 해주세요.");
        userIdInput.focus();
        return null;
    }

    if (!nickname) {
        await appAlert("닉네임을 입력해주세요.");
        nicknameInput.focus();
        return null;
    }

    if (!password) {
        setFieldMessage(passwordMsg, "비밀번호를 입력해주세요.", "is-error");
        await appAlert("비밀번호를 입력해주세요.");
        passwordInput.focus();
        return null;
    }

    if (!isPasswordValid(password)) {
        updatePasswordMessage();
        await appAlert("비밀번호는 8자 이상이며 영문 대문자, 소문자, 숫자, 특수문자를 모두 포함해야 합니다.");
        passwordInput.focus();
        return null;
    }

    if (!passwordConfirm) {
        setFieldMessage(passwordConfirmMsg, "비밀번호를 다시 입력해주세요.", "is-error");
        await appAlert("비밀번호를 다시 입력해주세요.");
        passwordConfirmInput.focus();
        return null;
    }

    if (password !== passwordConfirm) {
        updatePasswordConfirmMessage();
        await appAlert("비밀번호가 일치하지 않습니다.");
        passwordConfirmInput.focus();
        return null;
    }

    return { email, password, nickname };
}

// 이메일 중복확인. 화면에는 이메일만 있어도 되고, 가입 API 409로 이미 있는 이메일을 막음
checkEmailBtn.addEventListener("click", async () => {
    const email = userIdInput.value.trim();

    if (!email) {
        resetEmailCheck();
        setEmailMessage("이메일을 입력해주세요.", "is-error");
        userIdInput.focus();
        return;
    }

    if (!EMAIL_PATTERN.test(email)) {
        resetEmailCheck();
        setEmailMessage("올바른 이메일 형식이 아닙니다.", "is-error");
        userIdInput.focus();
        return;
    }

    checkEmailBtn.disabled = true;

    try {
        const { ok, status, data } = await requestSignup({
            email,
            password: "1234",
            nickname: `check${Date.now()}`.slice(0, 20),
        });

        if (status === 409) {
            resetEmailCheck();
            setEmailMessage("이미 가입된 이메일입니다.", "is-error");
            userIdInput.focus();
            return;
        }

        if (!ok) {
            resetEmailCheck();
            setEmailMessage(data.message || "중복확인에 실패했습니다.", "is-error");
            return;
        }

        checkedEmail = email;
        setEmailMessage("사용 가능한 이메일입니다.", "is-ok");
    } catch (error) {
        console.error("중복확인 실패:", error);
        resetEmailCheck();
        setEmailMessage("서버와 통신할 수 없습니다.", "is-error");
        await appAlert("서버와 통신할 수 없습니다.");
    } finally {
        checkEmailBtn.disabled = false;
    }
});

userIdInput.addEventListener("input", () => {
    if (!checkedEmail) {
        return;
    }

    if (userIdInput.value.trim() !== checkedEmail) {
        resetEmailCheck();
        setEmailMessage("이메일이 변경되었습니다. 중복확인을 다시 해주세요.", "is-error");
    }
});

passwordInput.addEventListener("input", () => {
    updatePasswordMessage();
    updatePasswordConfirmMessage();
});
passwordConfirmInput.addEventListener("input", updatePasswordConfirmMessage);

// 회원가입 제출
registerForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const userData = await validateSignupForm();
    if (!userData) {
        return;
    }

    await signupUser(userData);
});

async function requestSignup(userData) {
    const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(userData)
    });

    const data = await response.json();
    return {
        ok: response.ok,
        status: response.status,
        data
    };
}

// POST /api/auth/signup
async function signupUser(userData) {
    try {
        const { ok, status, data } = await requestSignup(userData);

        if (!ok) {
            if (status === 409) {
                resetEmailCheck();
                setEmailMessage("이미 가입된 이메일입니다.", "is-error");
                await appAlert(data.message || "이미 가입된 이메일입니다.");
                userIdInput.focus();
                return;
            }

            await appAlert(data.message || "회원가입에 실패했습니다.");
            return;
        }

        // 가입만 하고 토큰은 저장하지 않음. 로그인 페이지에서 직접 로그인
        await appAlert("회원가입이 완료되었습니다.");
        location.href = "./login.html";
    } catch (error) {
        console.error("회원가입 요청 실패:", error);
        await appAlert("서버와 통신할 수 없습니다.");
    }
}
