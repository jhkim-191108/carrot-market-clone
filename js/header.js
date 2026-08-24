// 먼저 조작할 header요소 querySelector로 저장
const loginStatus = document.querySelector("#loginStatusHeader");
const logoutStatus = document.querySelector("#logoutStatusHeader");
const logoutButton = document.querySelector("#upperLogoutButton");
const dropdownLogoutButton = document.querySelector(".dropdown-logout");
const tradeNav = document.querySelector("#tradeNav") || document.querySelector(".mainLogoText");
const locationNav = document.querySelector("#locationNav") || document.querySelector(".locationVerify");
const profile = document.querySelector("#profileButton");
const profileDropdown = document.querySelector(".profileDropdown");
const dropdownMenu = document.querySelector("#dropdownMenu");
const searchForm = document.querySelector("#searchForm");
const searchTextArea = document.querySelector("#searchTextArea");
const searchToggle = document.querySelector("#searchToggle");
const searchWrap = document.querySelector(".searchWrap");
const upperBar = document.querySelector(".upperBar");
const footerChatLink = document.querySelector("#footerChatLink");

localStorage.removeItem("token");

// 작은 화면에서 연 검색창 닫기
function closeSearchMenu() {
    if (!searchWrap || !searchToggle) {
        return;
    }

    searchWrap.classList.remove("is-open");
    searchToggle.setAttribute("aria-expanded", "false");
}

// 로그인 상태를 전달받는 함수
// 로그인 여부에 따라 버튼, 동네인증, 프로필 메뉴를 바꿈
function headerStatus(isLoggedIn) {
    if (logoutStatus) {
        logoutStatus.hidden = isLoggedIn;
    }
    if (loginStatus) {
        loginStatus.hidden = !isLoggedIn;
    }
    if (locationNav) {
        locationNav.hidden = !isLoggedIn;
    }
    if (footerChatLink) {
        footerChatLink.hidden = !isLoggedIn;
    }
    if (upperBar) {
        upperBar.classList.toggle("is-logged-in", isLoggedIn);
    }
    if (!isLoggedIn) {
        closeProfileMenu();
    }
}

headerStatus(false);

async function syncHeaderAuth() {
    try {
        const response = await fetch("/api/auth/me");
        headerStatus(response.ok);
    } catch (error) {
        headerStatus(false);
    }
}

syncHeaderAuth();

// 쿠키 지우고 홈으로
async function logout() {
    try {
        await fetch("/api/auth/logout", { method: "POST" });
    } catch (error) {
        console.error(error);
    }

    localStorage.removeItem("token");
    headerStatus(false);
    location.href = "./onboarding.html";
}

if (logoutButton) {
    logoutButton.addEventListener("click", logout);
}

if (dropdownLogoutButton) {
    dropdownLogoutButton.addEventListener("click", logout);
}

function isMobileHeader() {
    return window.matchMedia("(max-width: 768px)").matches;
}

// 프로필 드롭다운 닫기
function closeProfileMenu() {
    if (!dropdownMenu || !profile) {
        return;
    }

    dropdownMenu.hidden = true;
    profile.setAttribute("aria-expanded", "false");
}

// 데스크톱: 마이페이지로. 모바일: 드롭다운(마이페이지/채팅/로그아웃)
if (profile) {
    profile.addEventListener("click", function (event) {
        if (!isMobileHeader()) {
            location.href = "./mypage.html";
            return;
        }

        event.stopPropagation();
        closeSearchMenu();
        const isOpen = !dropdownMenu.hidden;
        dropdownMenu.hidden = isOpen;
        profile.setAttribute("aria-expanded", String(!isOpen));
    });
}

// 바깥 클릭하면 프로필 메뉴 닫기
document.addEventListener("click", function (event) {
    if (!profileDropdown || !dropdownMenu || dropdownMenu.hidden) {
        return;
    }

    if (!profileDropdown.contains(event.target)) {
        closeProfileMenu();
    }
});

// 작은 화면 돋보기. 검색창 열고 프로필 메뉴는 닫음
if (searchToggle && searchWrap) {
    searchToggle.addEventListener("click", function (event) {
        event.stopPropagation();

        const isOpen = searchWrap.classList.toggle("is-open");
        searchToggle.setAttribute("aria-expanded", String(isOpen));
        closeProfileMenu();

        if (isOpen && searchTextArea) {
            searchTextArea.focus();
        }
    });
}

// 바깥 클릭하면 검색창 닫기
document.addEventListener("click", function (event) {
    if (!searchWrap || !searchWrap.classList.contains("is-open")) {
        return;
    }

    if (!searchWrap.contains(event.target)) {
        closeSearchMenu();
    }
});

// 화면이 커지면 모바일 메뉴/검색창 닫기
window.addEventListener("resize", function () {
    if (!isMobileHeader()) {
        closeProfileMenu();
        closeSearchMenu();
    }
});

// 지금 페이지면 중고거래/동네인증 글자를 주황으로
function updateActiveNav() {
    const currentPage = location.pathname;
    const tradePages = [
        "trade.html",
        "trade-post.html",
        "write.html",
        "search.html",
        "chat.html"
    ];
    const isTradePage = tradePages.some(function (page) {
        return currentPage.endsWith(page);
    });

    if (tradeNav) {
        tradeNav.classList.remove("activeNav");
        if (isTradePage) {
            tradeNav.classList.add("activeNav");
        }
    }

    if (locationNav) {
        locationNav.classList.remove("activeNav");
        if (currentPage.endsWith("/location.html")) {
            locationNav.classList.add("activeNav");
        }
    }
}

updateActiveNav();

if (searchForm && searchTextArea) {
    searchForm.addEventListener("submit", function (event) {
        // form이 하려는 새로고침/전송을 막음
        event.preventDefault();

        // 검색창에 입력한 글자를 가져옴
        const keyword = searchTextArea.value.trim();
        // trim이 글자만 남겨줌

        // 검색 페이지로 이동하면서 검색어를 주소에 같이 넣어줌
        location.href = `./search.html?keyword=${encodeURIComponent(keyword)}`;
        // 페이지 + ?(구분자) + keyword=검색어
    });
}
