// 마이페이지. 내 정보 조회/수정, 프로필 사진은 파일 업로드
let profileImageUrl = "";

// JSON 요청용. 로그인은 HttpOnly 쿠키로 서버가 붙임
function authHeaders(extra = {}) {
    return { ...extra };
}

// 가입일 포맷
function formatJoinDate(dateString) {
    if (!dateString) {
        return "";
    }

    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();

    return `${year}년 ${month}월 ${day}일 가입`;
}

// 내 정보 표시
function renderUser(user) {
    const avatar = document.querySelector("#profileImage");
    const hasImage = user.profileImage && user.profileImage !== "string";

    if (hasImage) {
        avatar.style.backgroundImage = `url("${user.profileImage}")`;
    } else {
        avatar.style.backgroundImage = "";
    }

    document.querySelector("#nickname").textContent = user.nickname || "";
    document.querySelector("#email").textContent = user.email || "";
    document.querySelector("#location").textContent = user.location || "";
    document.querySelector("#createdAt").textContent = formatJoinDate(user.createdAt);

    document.querySelector("#nicknameInput").value = user.nickname || "";
    // 지역은 동네인증에서만 변경. 입력칸은 disabled
    document.querySelector("#locationInput").value = user.location || "";
    profileImageUrl = hasImage ? user.profileImage : "";
}

// GET /api/auth/me. 없으면 로그인으로
async function fetchMe() {
    try {
        const response = await fetch("/api/auth/me", {
            headers: authHeaders(),
        });

        const data = await response.json();

        if (!response.ok) {
            await appAlert(data.message || "로그인이 필요합니다.");
            location.href = "./login.html";
            return;
        }

        renderUser(data.user);
    } catch (error) {
        console.error(error);
    }
}

// PATCH /api/auth/me
async function updateMe(userData) {
    try {
        const response = await fetch("/api/auth/me", {
            method: "PATCH",
            headers: authHeaders({
                "Content-Type": "application/json",
            }),
            body: JSON.stringify(userData),
        });

        const data = await response.json();

        if (!response.ok) {
            await appAlert(data.message || "정보 수정에 실패했습니다.");
            return;
        }

        renderUser(data.user);
        await appAlert("정보가 수정되었습니다.");
    } catch (error) {
        console.error(error);
    }
}

// 정보 수정 제출
document.querySelector("#mypageForm").addEventListener("submit", async (event) => {
    event.preventDefault();

    const nickname = document.querySelector("#nicknameInput").value.trim();
    const location = document.querySelector("#locationInput").value.trim();

    await updateMe({
        nickname,
        location,
        profileImage: profileImageUrl || null,
    });
});

// 카메라 뱃지로 고른 파일을 POST /api/images 한 뒤 URL 보관
document.querySelector("#profileImageFile").addEventListener("change", async (event) => {
    const file = event.target.files[0];
    if (!file) {
        return;
    }

    const formData = new FormData();
    formData.append("image", file);

    try {
        const response = await fetch("/api/images", {
            method: "POST",
            headers: authHeaders(),
            body: formData,
        });

        const data = await response.json();

        if (!response.ok) {
            await appAlert(data.message || "이미지 업로드에 실패했습니다.");
            return;
        }

        profileImageUrl = data.image.url;
        document.querySelector("#profileImage").style.backgroundImage = `url("${profileImageUrl}")`;
    } catch (error) {
        console.error("이미지 업로드 실패:", error);
        await appAlert("이미지 업로드 중 오류가 발생했습니다.");
    }
});

// 페이지 시작
fetchMe();
