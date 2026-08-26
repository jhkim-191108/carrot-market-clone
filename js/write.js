// 글쓰기/수정. 주소에 ?id= 있으면 수정, 없으면 새 글
const fileInput = document.querySelector("#write-image");
const cameraIcon = document.querySelector(".icon-camera");
const preview = document.querySelector(".preview");
const imgCount = document.querySelector(".img-count");
const params = new URLSearchParams(window.location.search);
const editId = params.get("id");

let uploadedImageUrl = "";

function showImagePreview(url) {
  uploadedImageUrl = url;
  preview.src = url;
  preview.hidden = false;
  cameraIcon.hidden = true;
  imgCount.hidden = true;
}

// 고른 사진을 POST /api/images 하고 미리보기
fileInput.addEventListener("change", async () => {
  const file = fileInput.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append("image", file);

  try {
    const response = await fetch("/api/images", {
      method: "POST",
      body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
      await appAlert(data.message || "이미지 업로드에 실패했습니다.");
      return;
    }

    showImagePreview(data.image.url);
  } catch (error) {
    console.error("이미지 업로드 실패:", error);
    await appAlert("이미지 업로드 중 오류가 발생했습니다.");
  }
});

// 수정이면 기존 글 채움. 본인 글 아니면 상세로 돌려보냄
async function loadProductForEdit() {
  if (!editId) {
    return;
  }

  try {
    const [productResponse, meResponse] = await Promise.all([
      fetch(`/api/products/${editId}`),
      fetch("/api/auth/me"),
    ]);

    const data = await productResponse.json();
    const meData = await meResponse.json();

    if (!productResponse.ok) {
      await appAlert(data.message || "상품 정보를 불러오지 못했습니다.");
      return;
    }

    if (!meResponse.ok) {
      await appAlert(meData.message || "로그인이 필요합니다.");
      location.href = "./login.html";
      return;
    }

    const product = data.product || data;
    const sellerId = product.seller?.id;
    const myId = meData.user?.id;

    if (String(sellerId) !== String(myId)) {
      await appAlert("본인 게시글만 수정할 수 있습니다.");
      location.href = `./trade-post.html?id=${editId}`;
      return;
    }

    document.querySelector("#write-title").value = product.title || "";
    document.querySelector("#write-price").value = product.price || "";
    document.querySelector("#write-desc").value = product.description || "";
    document.querySelector("#write-place").value = product.location || "";

    if (product.thumbnail?.startsWith("http")) {
      showImagePreview(product.thumbnail);
    }
  } catch (error) {
    console.error("상품 정보를 못 가져왔어요:", error);
    await appAlert("상품 정보를 불러오는 중 오류가 발생했습니다.");
  }
}

loadProductForEdit();

// 완료. 수정은 PATCH, 새 글은 POST
document.querySelector(".btn-done").addEventListener("click", async () => {
  const title = document.querySelector("#write-title").value;
  const price = Number(
    document.querySelector("#write-price").value.replace(/[^0-9]/g, ""),
  );
  const description = document.querySelector("#write-desc").value;
  const location = document.querySelector("#write-place").value;

  if (!title || !price) {
    await appAlert("제목과 가격을 입력해주세요.");
    return;
  }

  const body = {
    title,
    description,
    price,
    location,
    images: uploadedImageUrl ? [uploadedImageUrl] : [],
  };

  const isEdit = Boolean(editId);
  const url = isEdit ? `/api/products/${editId}` : "/api/products";
  const method = isEdit ? "PATCH" : "POST";

  try {
    const response = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      await appAlert(data.message || "저장에 실패했습니다.");
      return;
    }

    window.location.href = `trade-post.html?id=${data.product.id}`;
  } catch (error) {
    console.error("상품 저장 실패:", error);
    await appAlert("상품 저장 중 오류가 발생했습니다.");
  }
});

