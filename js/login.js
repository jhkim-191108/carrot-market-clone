// 로그인. 아이디 칸 값을 API email로 보내고, 성공하면 서버가 쿠키에 토큰 저장
const loginForm = document.querySelector("#loginForm");

// 로그인 제출
loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const userId = document.querySelector("#userId").value.trim();
    const password = document.querySelector("#password").value;

    await loginUser({
        email: userId,
        password
    });
});

// POST /api/auth/login
async function loginUser(userData) {
    try {
        const response = await fetch("/api/auth/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(userData)
        });

        const data = await response.json();

        if (!response.ok) {
            await appAlert(data.message || "로그인에 실패했습니다.");
            return;
        }

        await appAlert("로그인되었습니다.");
        location.href = "./onboarding.html";
    } catch (error) {
        console.error("로그인 요청 실패:", error);
        await appAlert("서버와 통신할 수 없습니다.");
    }
}
