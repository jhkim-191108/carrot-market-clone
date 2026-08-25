// =========================================================
// 동네인증 페이지 스크립트
// - .location-set  : 직접 검색해서 내 동네만 "내 동네 설정"으로 화면에 확정 (서버 저장 안 함)
// - .location-verify: "동네인증 완료하기"를 누르면 마이페이지(PATCH /api/auth/me)에 location 저장
// =========================================================

// Nominatim(OpenStreetMap) API 주소
const REVERSE_URL = "https://nominatim.openstreetmap.org/reverse"; // 좌표 -> 주소
const GEO_URL = "https://nominatim.openstreetmap.org/search";      // 검색어 -> 주소 후보 목록

// GPS를 못 쓰거나(브라우저 미지원) 사용자가 위치 권한을 거부했을 때 쓸 기본값
const FALLBACK = {
    name: "서울 강서구 화곡동",
    lat: 37.5407,
    lng: 126.8406,
    si: "서울특별시",
    gu: "강서구",
    dong: "화곡동",
};

// ---------- DOM 참조 ----------
const titleEl = document.querySelector('[data-role="title"]');
const inputEl = document.querySelector('[data-role="input"]');
const resultsEl = document.querySelector('[data-role="search-results"]');
const setBtn = document.querySelector('[data-role="edit-btn"]');
const setStatusEl = document.querySelector('[data-role="set-status"]');
const statusEl = document.querySelector('[data-role="status"]');
const confirmBtn = document.querySelector('[data-role="confirm-btn"]');
const map = document.querySelector('#map');

// 검색한 동네가 현재 위치와 너무 다를 때 띄우는 확인 모달
const distanceModal = document.querySelector('[data-role="distance-modal"]');
const modalCancelBtn = document.querySelector('[data-role="modal-cancel"]');
const modalEditBtn = document.querySelector('[data-role="modal-edit"]');

// ---------- 상태값 ----------
let myDong = null;           // 내 동네 설정으로 확정한 동네 (시 구 동)
let isCertified = false;     // 동네인증 완료하기를 눌러 서버에 저장했는지
let currentDong = null;      // 화면에 보여줄 GPS 주소 문자열
let currentAddress = null;   // { si, gu, dong } - GPS 위치 비교용
let selectedDong = null;     // 검색 목록에서 고른 동네 이름 (화면 표시용)
let selectedCoords = null;   // 검색해서 고른 위치의 좌표
let selectedAddress = null;  // { si, gu, dong } - 검색해서 고른 위치 비교용
let searchList = [];         // 마지막 검색 결과 원본 목록 (클릭 시 index로 다시 찾기 위함)

// ---------- 지도 ----------
// 좌표를 중심으로 한 작은 bbox(영역)를 만들어 OpenStreetMap embed URL 생성
function buildMapUrl(lat, lng) {
    const d = 0.008;
    const bbox = [lng - d, lat - d, lng + d, lat + d].join(",");
    return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lng}`;
}
function showMap(lat, lng) {
    map.src = buildMapUrl(lat, lng);
}

// ---------- Nominatim address 객체 -> {si, gu, dong} ----------
// Nominatim은 지역마다 필드명이 조금씩 달라서(quarter/neighbourhood/suburb/village 등)
// 여러 후보를 우선순위대로 시도해서 하나라도 있으면 그걸 씀
// 시/도 이름인지 (서울특별시, 대구광역시 등)
function isSiName(name) {
    return /광역시$|특별시$|특별자치시$|도$/.test(name);
}

// 구/군 이름인지
function isGuName(name) {
    return /구$|군$/.test(name);
}

function extractAddressParts(addr) {
    // 한국 동은 quarter뿐 아니라 legal(행정구역)로 오는 경우가 있음
    let dong =
        addr.quarter ||
        addr.neighbourhood ||
        addr.suburb ||
        addr.village ||
        addr.town ||
        addr.hamlet ||
        addr.legal ||
        "";

    if (!dong) {
        // quarter/legal이 비면, 끝이 동/가/읍/면/리인 값을 동으로 씀
        for (const value of Object.values(addr)) {
            if (
                typeof value === "string" &&
                /[동일가읍면리]$/.test(value) &&
                !isSiName(value) &&
                !isGuName(value)
            ) {
                dong = value;
                break;
            }
        }
    }

    // city가 구 이름인 경우가 있어서, 광역시/도는 province·state·city 순으로 고름
    let si = "";
    for (const name of [addr.province, addr.state, addr.city]) {
        if (name && isSiName(name)) {
            si = name;
            break;
        }
    }
    if (!si) {
        si = addr.province || addr.state || addr.city || "";
    }

    let gu = "";
    for (const name of [addr.borough, addr.city_district, addr.county, addr.city]) {
        if (name && isGuName(name)) {
            gu = name;
            break;
        }
    }

    return { si, gu, dong };
}

// "대구광역시 달서구 두류동"처럼 시/구/동 순으로 붙임
function formatDong(parts) {
    if (!parts) {
        return "";
    }

    return [parts.si, parts.gu, parts.dong].filter(Boolean).join(" ");
}

// ---------- 좌표 -> 주소 (GPS 자동감지용) ----------
async function reverseGeocode(lat, lng) {
    const url = new URL(REVERSE_URL);
    url.searchParams.set("lat", lat);
    url.searchParams.set("lon", lng);
    url.searchParams.set("format", "json");
    url.searchParams.set("accept-language", "ko"); // 한글 주소로 받기
    const res = await fetch(url);
    if (!res.ok) throw new Error("주소 변환 실패 (HTTP " + res.status + ")");
    const data = await res.json();
    return extractAddressParts(data.address ?? {});
}

// ---------- 동네 이름 -> 후보 목록 (직접 검색용, 주소 상세 포함) ----------
async function geocode(query, count = 5) {
    const url = new URL(GEO_URL);
    url.searchParams.set("q", query);
    url.searchParams.set("format", "json");
    url.searchParams.set("addressdetails", "1"); // si/gu/dong 비교를 위해 상세 주소 포함
    url.searchParams.set("accept-language", "ko");
    url.searchParams.set("limit", count);
    const res = await fetch(url);
    if (!res.ok) throw new Error("검색 실패 (HTTP " + res.status + ")");
    return res.json();
}

// ---------- 같은 동네인지 주소로 비교 ----------
// 좌표 거리 대신 시/구/동 문자열을 직접 비교함
function isSameArea(current, selected) {
    if (!current || !selected) return false;
    if (!current.gu || !selected.gu) return false;
    if (current.si && selected.si && current.si !== selected.si) return false;
    if (current.gu !== selected.gu) return false;
    if (selected.dong) {
        return current.dong === selected.dong;
    }
    return true; // 검색 결과에 동 정보가 없으면 구까지만 맞아도 통과

}

// ---------- 검색 결과 목록 렌더링 ----------
function renderResults(list) {
    searchList = list; // 클릭 이벤트에서 index로 다시 찾기 위해 원본 저장
    resultsEl.replaceChildren();
    if (!list.length) {
        resultsEl.hidden = true;
        return;
    }
    list.forEach((place, i) => {
        const li = document.createElement("li");
        li.textContent = place.display_name;
        li.dataset.index = i; // 클릭 시 이 index로 searchList에서 원본 데이터 찾음
        resultsEl.appendChild(li);
    });
    resultsEl.hidden = false;
}

// ---------- 거리(주소 불일치) 초과 모달 ----------
function openDistanceModal() {
    distanceModal.hidden = false;
}
function closeDistanceModal() {
    distanceModal.hidden = true;
}
// 취소 버튼 -> 그냥 모달만 닫기
modalCancelBtn.addEventListener("click", closeDistanceModal);
// 동네 수정하기 버튼 -> 모달 닫고 입력값/선택값 초기화해서 다시 검색하게 함
modalEditBtn.addEventListener("click", () => {
    closeDistanceModal();
    inputEl.value = "";
    inputEl.focus();
    selectedDong = null;
    selectedCoords = null;
    selectedAddress = null;
});
// 모달 바깥(반투명 배경) 클릭 시에도 닫히게
distanceModal.addEventListener("click", (e) => {
    if (e.target === distanceModal) closeDistanceModal();
});

// 검색 결과 클릭. 입력창에는 display_name 대신 시 구 동 형식을 넣음
resultsEl.addEventListener("click", (e) => {
    const li = e.target.closest("li");
    if (!li) return;
    const place = searchList[Number(li.dataset.index)];
    if (!place) return;
    selectedDong = place.display_name;
    selectedCoords = { lat: Number(place.lat), lng: Number(place.lon) };
    selectedAddress = extractAddressParts(place.address ?? {});
    inputEl.value = formatDong(selectedAddress) || selectedDong;
    resultsEl.hidden = true;
    setStatusEl.textContent = "";
    setStatusEl.classList.remove("is-error");
});

// 입력할 때마다 (디바운스 적용) 검색
// 타이핑할 때마다 바로 API를 호출하지 않고, 300ms 동안 추가 입력이 없을 때만 검색 실행
let debounceTimer = null;
inputEl.addEventListener("input", () => {
    clearTimeout(debounceTimer);
    // 입력값이 바뀌면 이전에 선택했던 결과는 무효화
    selectedDong = null;
    selectedCoords = null;
    selectedAddress = null;
    const query = inputEl.value.trim();
    if (!query) {
        renderResults([]);
        return;
    }
    debounceTimer = setTimeout(async () => {
        try {
            const list = await geocode(query);
            renderResults(list);
        } catch (err) {
            console.error(err);
            renderResults([]);
        }
    }, 300);
});

// "내 동네 설정" 버튼: 검색해서 고른 동네가 현재 GPS 주소와 같은 구/동인지 확인 후 확정
setBtn.addEventListener("click", async () => {
    // 목록에서 아직 아무것도 안 골랐으면 안내 문구만 띄우고 중단
    if (!selectedCoords) {
        setStatusEl.textContent = "목록에서 동네를 선택해주세요.";
        setStatusEl.classList.add("is-error");
        return;
    }

    // GPS 위치를 아직 확인 못했으면(비동기 진행 중) 잠시 후 다시 시도하도록 안내
    if (!currentAddress) {
        setStatusEl.textContent = "현재 위치를 확인하는 중입니다. 잠시 후 다시 시도해주세요.";
        setStatusEl.classList.add("is-error");
        return;
    }

    // 현재 위치와 구/동이 다르면 바로 확정하지 않고 확인 모달을 띄움
    if (!isSameArea(currentAddress, selectedAddress)) {
        openDistanceModal();
        return;
    }

    setStatusEl.textContent = "";
    setStatusEl.classList.remove("is-error");

    // 화면 확정만. 마이페이지 저장은 동네인증 완료하기에서 함
    myDong = formatDong(selectedAddress) || selectedDong;
    isCertified = false;
    resultsEl.hidden = true;
    renderState();
    await appAlert("내 동네 설정이 완료되었습니다.");
});

// "동네인증 완료하기" 버튼: 설정해 둔 내 동네를 마이페이지에 저장
confirmBtn.addEventListener("click", async () => {
    if (!currentDong) return; // GPS 위치 확인 전이면 아무것도 안 함 (버튼도 disabled 상태)

    // 당근처럼 내 동네를 먼저 고른 뒤에만 인증
    if (!myDong) {
        statusEl.textContent = "내 동네를 먼저 설정해주세요.";
        return;
    }

    // 설정한 동네가 현재 위치와 다르면 인증하지 않음
    if (!isSameArea(currentAddress, selectedAddress)) {
        openDistanceModal();
        return;
    }

    // 서버에 내 동네 저장
    try {
        const response = await fetch("/api/auth/me", {
            method: "PATCH",
            headers: authHeaders({
                "Content-Type": "application/json",
            }),
            body: JSON.stringify({
                location: myDong,
            }),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || "동네 저장에 실패했습니다.");
        }

        console.log("동네 저장 완료:", data.user.location);
        isCertified = true;
        renderState();
        await appAlert("동네인증이 완료되었습니다. 마이페이지에서 지역을 확인하세요");

    } catch (error) {
        console.error("동네 저장 실패:", error);
        statusEl.textContent = "동네 저장에 실패했습니다.";
    }
});

// ---------- 상태 렌더링 ----------
// 내 동네 설정 후면 제목을 "설정된 동네:"로 바꾸고, 서버 저장 후에만 인증 완료 문구
function renderState() {
    if (myDong) {
        titleEl.textContent = `설정된 동네: ${myDong}`;
        if (isCertified) {
            statusEl.textContent = "동네 인증이 완료되었습니다.";
        } else {
            statusEl.textContent = currentDong
                ? `현재 위치: ${currentDong}`
                : "위치를 확인하는 중입니다...";
        }
    } else {
        titleEl.textContent = "어디에 살고 계신가요?";
        statusEl.textContent = currentDong
            ? `현재 위치: ${currentDong}`
            : "위치를 확인하는 중입니다...";
    }
}

// ---------- GPS로 현재 위치 자동 감지 ----------
// 페이지 진입 시 자동 실행
function showMyLocation() {
    // 브라우저가 geolocation 자체를 지원하지 않는 경우 -> 바로 FALLBACK 사용
    if (!navigator.geolocation) {
        currentAddress = { si: FALLBACK.si, gu: FALLBACK.gu, dong: FALLBACK.dong };
        currentDong = FALLBACK.name;
        showMap(FALLBACK.lat, FALLBACK.lng);
        confirmBtn.disabled = false;
        renderState();
        return;
    }
    navigator.geolocation.getCurrentPosition(
        // 성공 콜백: 좌표를 얻어와서 지도 표시 + 주소로 역변환
        async function (position) {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            showMap(lat, lng);
            try {
                currentAddress = await reverseGeocode(lat, lng);
                currentDong = formatDong(currentAddress);
            } catch (err) {
                // 역지오코딩 API 실패 시에도 FALLBACK으로 대체해서 흐름이 끊기지 않게 함
                currentAddress = { si: FALLBACK.si, gu: FALLBACK.gu, dong: FALLBACK.dong };
                currentDong = FALLBACK.name;
                console.error(err);
            }
            confirmBtn.disabled = false;
            renderState();
        },
        // 실패 콜백: 사용자가 위치 권한을 거부했거나 오류가 난 경우 -> FALLBACK 사용
        function () {
            currentAddress = { si: FALLBACK.si, gu: FALLBACK.gu, dong: FALLBACK.dong };
            currentDong = FALLBACK.name;
            showMap(FALLBACK.lat, FALLBACK.lng);
            confirmBtn.disabled = false;
            renderState();
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
}

// 요청 헤더. 로그인은 HttpOnly 쿠키로 서버가 붙임
function authHeaders(extra = {}) {
    return { ...extra };
}

// 페이지 진입 시 초기 상태 표시 + GPS 위치 감지 시작
renderState();
showMyLocation();