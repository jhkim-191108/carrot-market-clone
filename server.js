// 로컬 Express. 당근 API로 넘기고 html/css/js를 제공. 페이지는 localhost:3000으로 열기
const http = require("http");
const express = require("express");
const { WebSocketServer, WebSocket } = require("ws");
require("dotenv").config();

const app = express();
const PORT = 3000;

const API_KEY = process.env.API_KEY;
const API_BASE = "https://carrot.techfree.kr";
const AUTH_COOKIE = "authToken";

function parseCookies(cookieHeader) {
  const cookies = {};

  String(cookieHeader || "").split(";").forEach((part) => {
    const trimmed = part.trim();
    if (!trimmed) {
      return;
    }

    const eq = trimmed.indexOf("=");
    if (eq === -1) {
      return;
    }

    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (value.startsWith("\"") && value.endsWith("\"")) {
      value = value.slice(1, -1);
    }

    try {
      cookies[key] = decodeURIComponent(value);
    } catch (error) {
      cookies[key] = value;
    }
  });

  return cookies;
}

function cookieToken(req) {
  return parseCookies(req.headers.cookie)[AUTH_COOKIE] || "";
}

function isHttps(req) {
  return Boolean(req.secure || req.headers["x-forwarded-proto"] === "https");
}

function authCookieFlags(req, maxAge) {
  const parts = ["HttpOnly", "Path=/", "SameSite=Lax", `Max-Age=${maxAge}`];
  if (isHttps(req)) {
    parts.push("Secure");
  }
  return parts.join("; ");
}

function setAuthCookie(res, token, req) {
  res.setHeader("Set-Cookie", `${AUTH_COOKIE}=${encodeURIComponent(token)}; ${authCookieFlags(req, 604800)}`);
}

function clearAuthCookie(res, req) {
  res.setHeader("Set-Cookie", `${AUTH_COOKIE}=; ${authCookieFlags(req, 0)}`);
}

function bearerFromRequest(req) {
  if (req.headers.authorization) {
    return req.headers.authorization;
  }

  const token = cookieToken(req);
  return token ? `Bearer ${token}` : "";
}

// 이미지 업로드. 파일을 그대로 넘겨야 해서 json 파서보다 앞에 둠
app.post("/api/images", async (req, res) => {
  try {
    const headers = { "X-API-Key": API_KEY };
    const authorization = bearerFromRequest(req);
    if (authorization) {
      headers.Authorization = authorization;
    }
    if (req.headers["content-type"]) {
      headers["Content-Type"] = req.headers["content-type"];
    }

    const response = await fetch(`${API_BASE}/api/images`, {
      method: "POST",
      headers,
      body: req,
      duplex: "half",
    });

    const text = await response.text();
    res.status(response.status).send(text);
  } catch (error) {
    console.error("이미지 업로드 실패:", error);
    res.status(500).json({ error: "이미지 업로드에 실패했습니다." });
  }
});

// json 본문 파싱 (이미지 업로드 이후)
app.use(express.json());

/* html, css, js, 이미지 파일 제공 */
app.use("/html", express.static("html"));
app.use("/css", express.static("css"));
app.use("/js", express.static("js"));
app.use("/images", express.static("images"));

// 주소창에 / 만 치면 온보딩으로
app.get("/", (req, res) => {
  res.redirect("/html/onboarding.html");
});

// 프론트 요청을 당근 API로 전달. API_KEY + 로그인 토큰 포함
async function proxyToApi(req, res, path) {
  try {
    const headers = {
      "X-API-Key": API_KEY,
    };

    const authorization = bearerFromRequest(req);
    if (authorization) {
      headers.Authorization = authorization;
    }

    const options = {
      method: (req.method || "GET").toUpperCase(),
      headers,
    };

    if (req.method !== "GET" && req.method !== "HEAD") {
      headers["Content-Type"] = "application/json";
      options.body = JSON.stringify(req.body);
    }

    const response = await fetch(`${API_BASE}${path}`, options);
    const text = await response.text();

    res.status(response.status).send(text);
  } catch (error) {
    console.error("API 요청 실패:", path, error);

    res.status(500).json({
      error: "서버에서 API 요청에 실패했습니다.",
    });
  }
}

// 회원가입. register.js에서 사용
app.post("/api/auth/signup", (req, res) => {
  proxyToApi(req, res, "/api/auth/signup");
});

// 로그인. 성공하면 HttpOnly 쿠키로 토큰 저장. JS에서는 토큰을 안 봄
app.post("/api/auth/login", async (req, res) => {
  try {
    const response = await fetch(`${API_BASE}/api/auth/login`, {
      method: "POST",
      headers: {
        "X-API-Key": API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(req.body),
    });

    const text = await response.text();
    let payload;

    try {
      payload = JSON.parse(text);
    } catch (error) {
      res.status(response.status).send(text);
      return;
    }

    if (response.ok && payload.token) {
      setAuthCookie(res, payload.token, req);
      delete payload.token;
    }

    res.status(response.status).json(payload);
  } catch (error) {
    console.error("로그인 요청 실패:", error);
    res.status(500).json({
      error: "서버에서 API 요청에 실패했습니다.",
    });
  }
});

// 로그아웃. 쿠키만 지움
app.post("/api/auth/logout", (req, res) => {
  clearAuthCookie(res, req);
  res.json({ ok: true });
});

// 내 정보 조회. 마이페이지, 채팅, 게시글 작성자 확인
app.get("/api/auth/me", (req, res) => {
  proxyToApi(req, res, "/api/auth/me");
});

// 내 정보 수정. 마이페이지
app.patch("/api/auth/me", (req, res) => {
  proxyToApi(req, res, "/api/auth/me");
});

// 채팅 목록. chat.js
app.get("/api/chats", (req, res) => {
  proxyToApi(req, res, "/api/chats");
});

// 채팅방 만들기. 상품 상세에서 채팅하기
app.post("/api/chats", (req, res) => {
  proxyToApi(req, res, "/api/chats");
});

// 메시지 조회
app.get("/api/chats/:id/messages", (req, res) => {
  proxyToApi(req, res, `/api/chats/${req.params.id}/messages`);
});

// 메시지 보내기
app.post("/api/chats/:id/messages", (req, res) => {
  proxyToApi(req, res, `/api/chats/${req.params.id}/messages`);
});

// 채팅방 상세. 상대/상품 정보
app.get("/api/chats/:id", (req, res) => {
  proxyToApi(req, res, `/api/chats/${req.params.id}`);
});

// 채팅방 나가기
app.delete("/api/chats/:id", (req, res) => {
  proxyToApi(req, res, `/api/chats/${req.params.id}`);
});

// 상품 목록. 중고거래, 온보딩 인기매물
app.get("/api/products", (req, res) => {
//검색창에서 요청받은 query string까지 같이 전달하게 만들기(keyword=아이폰 부분까지)
    proxyToApi(req, res, req.originalUrl);
});

// 상품 상세. trade-post, 글 수정 시 기존 값 채우기
app.get("/api/products/:id", (req, res) => {
  proxyToApi(req, res, `/api/products/${req.params.id}`);
});

// 상품 삭제. trade-post 삭제하기
app.delete("/api/products/:id", (req, res) => {
  proxyToApi(req, res, `/api/products/${req.params.id}`);
});

// 거래 상태 변경. 채팅에서 거래중/예약중/거래완료
app.patch("/api/products/:id/status", (req, res) => {
  proxyToApi(req, res, `/api/products/${req.params.id}/status`);
});

// 상품 수정. write.js에서 ?id= 있을 때
app.patch("/api/products/:id", (req, res) => {
  proxyToApi(req, res, `/api/products/${req.params.id}`);
});

// 상품 등록. write.js 새 글
app.post("/api/products", (req, res) => {
  proxyToApi(req, res, "/api/products");
});

// 오늘 남은 API·이미지 횟수. 브라우저에서 /api/usage 로 확인
app.get("/api/usage", (req, res) => {
  proxyToApi(req, res, "/api/usage");
});

// 위에 없는 /api 경로는 그대로 당근 API로
app.use((req, res, next) => {
  if (!req.path.startsWith("/api/")) {
    return next();
  }
  proxyToApi(req, res, req.originalUrl);
});

// 브라우저 /ws → 당근 wss://.../ws . API_KEY는 서버만 붙임
function attachChatSocket(server) {
  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (client, req) => {
    let token = "";

    try {
      const url = new URL(req.url, "http://localhost");
      token = url.searchParams.get("token") || cookieToken(req);
    } catch (error) {
      console.error("웹소켓 주소 파싱 실패:", error);
    }

    const query = new URLSearchParams({
      apiKey: API_KEY || "",
      token,
    });
    const upstreamUrl = `${API_BASE.replace(/^http/, "ws")}/ws?${query}`;
    const upstream = new WebSocket(upstreamUrl);
    const pending = [];

    const sendTo = (socket, data, isBinary) => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(data, { binary: isBinary });
      }
    };

    client.on("message", (data, isBinary) => {
      if (upstream.readyState === WebSocket.OPEN) {
        sendTo(upstream, data, isBinary);
        return;
      }
      pending.push([data, isBinary]);
    });

    upstream.on("open", () => {
      pending.forEach(([data, isBinary]) => sendTo(upstream, data, isBinary));
      pending.length = 0;
    });

    upstream.on("message", (data, isBinary) => {
      sendTo(client, data, isBinary);
    });

    const closeBoth = () => {
      if (client.readyState === WebSocket.OPEN) {
        client.close();
      }
      if (upstream.readyState === WebSocket.OPEN) {
        upstream.close();
      }
    };

    client.on("close", closeBoth);
    upstream.on("close", closeBoth);
    client.on("error", closeBoth);
    upstream.on("error", (error) => {
      console.error("당근 웹소켓 연결 실패:", error);
      closeBoth();
    });
  });
}

// 서버 시작. 웹소켓은 http.Server에 붙여야 함
if (require.main === module) {
  const server = http.createServer(app);
  attachChatSocket(server);
  server.listen(PORT, () => {
    console.log(`http://localhost:${PORT}`);
  });
}

module.exports = app;