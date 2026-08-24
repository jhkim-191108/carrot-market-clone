// DOM요소 연결
const mainSectionGrid = document.querySelector("#mainSectionGrid");
const pageNums = document.querySelector("#pageNums");
const prevPage = document.querySelector("#prevPage");
const nextPage = document.querySelector("#nextPage");
const searchInput = document.querySelector("#searchTextArea");

// 주소에서 검색어 가져오기
const params = new URLSearchParams(location.search);
const keyword = params.get("keyword") || "";

let currentPage = 1;
let totalPages = 1;
// 검색 결과가 페이지로 넘어가도 헤더 검색창에 기존 검색어가 남아있게 처리
if (searchInput) {
    searchInput.value = keyword;
}
// 검색어를 받아서 상품을 요청하는 함수만들기
async function getProducts(keyword, page = 1) {
    try{
        const response = await fetch(`/api/products?q=${encodeURIComponent(keyword)}&page=${page}&limit=8`);
        // 에러 확인
        if(!response.ok) throw new Error(response.status);
    // j.som형식으로 데이터 받기
    const data = await response.json();
    console.log(data);

    renderProducts(data.items);

    // 현재 페이지 표시
    currentPage = data.page;
    totalPages = data.totalPages;

    pageNums.textContent = `${currentPage} / ${totalPages}`;

    prevPage.disabled = currentPage <= 1;
    nextPage.disabled = currentPage >= totalPages;

    } catch (error) {
        console.error("실패", error.message);
    }
}

function renderProducts(products) {
    // HTML에 만들어둔 예시 상품카드 제거
    const oldCard = mainSectionGrid.querySelectorAll(".mainGridCardBox");

    oldCard.forEach(function (card) {
        card.remove();
    });

    // "검색 결과가 없습니다."가 생성된 뒤 다시 상품이 생겼을 때 이전 안내문이 남는 걸 방지.
    const oldEmpty = mainSectionGrid.querySelector(".emptyMessage");

    if (oldEmpty) {
        oldEmpty.remove();
    }

    // 검색결과없음 표시
    if (products.length === 0) {
        const empty = document.createElement("p");
        empty.classList.add("emptyMessage");
        empty.textContent = "검색 결과가 없습니다.";
        mainSectionGrid.append(empty);
        return;
    }

    // API에서 받은 상품들을 하나씩 반복
    // 받은 상품들(Products)에서 상품(product)을 하나 꺼내서 product라고 부름
    products.forEach(function (product) {
        // article을 하나 만들고 그 article을 card에 저장
        const card = document.createElement("article");
        // 위에 선언한 card에 클래스추가
        card.classList.add("mainGridCardBox");

        if (product.thumbnail?.startsWith("http")) {
            const img = document.createElement("img");
            img.src = product.thumbnail;
            img.alt = product.title || "";
            img.className = "productImg";
            card.append(img);
        }

        const info = document.createElement("div");
        info.className = "productInfo";

        const name = document.createElement("h3");
        name.className = "productName";
        name.textContent = product.title || "";

        const price = document.createElement("p");
        price.className = "productPrice";
        price.textContent = `${Number(product.price).toLocaleString()}원`;

        const address = document.createElement("p");
        address.className = "productAddress";
        address.textContent = product.location || "";

        info.append(name, price, address);

        const metaBox = document.createElement("div");
        metaBox.className = "productMeta";

        const viewMeta = document.createElement("span");
        viewMeta.className = "meta";
        viewMeta.textContent = `조회 ${product.viewCount}`;

        const dotMeta = document.createElement("span");
        dotMeta.className = "meta";
        dotMeta.textContent = "•";

        const chatMeta = document.createElement("span");
        chatMeta.className = "meta";
        chatMeta.textContent = `채팅 ${product.chatCount}`;

        metaBox.append(viewMeta, dotMeta, chatMeta);
        card.append(info, metaBox);
    // 상품 클릭처리
    card.addEventListener("click", function () {
        console.log("카드 클릭됨", product.id);
        location.href = `./trade-post.html?id=${product.id}`;
    });
    // HTML 내 mainSectionGrid에 append(추가)
    mainSectionGrid.append(card);
    });
}

// 나중에server.js로 옮겨서 넣을것
// app.get("/api/products", (req, res) => {
//     // 검색창에서 요청받은 query string까지 같이 전달하게 만들기(keyword=아이폰 부분까지)
//     proxyToApi(req, res, req.originalUrl);
// });

// 1에서 가져온 keyword를 2번 함수에 전달

// 페이지 넘기기 이벤트처리
prevPage.addEventListener("click", function () {
    if (currentPage <= 1) {
        return;
    }

    getProducts(keyword, currentPage - 1);
});

nextPage.addEventListener("click", function () {
    if (currentPage >= totalPages) {
        return;
    }

    getProducts(keyword, currentPage + 1);
});

getProducts(keyword, currentPage);
