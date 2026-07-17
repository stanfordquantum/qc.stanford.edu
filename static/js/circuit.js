/*
 * Hero background: a procedural mesh of orthogonal traces and pads meant
 * to evoke a superconducting quantum chip, with light pulses traveling
 * along the traces in place of the old "flying dots" field.
 */
(function () {
  var canvas = document.getElementById("circuit-canvas");
  if (!canvas) return;
  var ctx = canvas.getContext("2d");

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var CELL = 130;
  var JITTER = 0.16;
  var CONNECT_PROB = 0.52;
  var STUB_COUNT = 7;
  var PULSE_INTERVAL = [2200, 5200];
  var PULSE_SPEED = [70, 130]; // px / second

  // original (dark navy hero): LINE_COLOR "rgba(140, 172, 214, 0.22)",
  // NODE_STROKE "rgba(170, 199, 232, 0.45)", NODE_FILL "rgba(15, 22, 42, 0.65)"
  var LINE_COLOR = "rgba(210, 228, 250, 0.32)";
  var NODE_STROKE = "rgba(220, 236, 252, 0.55)";
  var NODE_FILL = "rgba(0, 20, 55, 0.55)";
  var PULSE_COLORS = ["#eaf6ff", "#eaf6ff", "#8fd9ff", "#eaf6ff", "#ff6b86"];

  // Keep the mesh clear of the hero copy: fully invisible within the inner
  // ellipse, smoothly fading back in by the time it reaches the outer one.
  var CLEAR_RX = 380;
  var CLEAR_RY = 260;
  var CLEAR_OUTER_SCALE = 1.7;

  function clearFactor(x, y) {
    var dx = (x - width / 2) / CLEAR_RX;
    var dy = (y - height / 2) / CLEAR_RY;
    var r = Math.sqrt(dx * dx + dy * dy);
    if (r <= 1) return 0;
    if (r >= CLEAR_OUTER_SCALE) return 1;
    var t = (r - 1) / (CLEAR_OUTER_SCALE - 1);
    return t * t * (3 - 2 * t);
  }

  var width, height, dpr;
  var edges = [];

  function rand(min, max) { return min + Math.random() * (max - min); }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  function dist(a, b) {
    return Math.hypot(b.x - a.x, b.y - a.y);
  }

  function makeEdge(a, b) {
    var horizontalFirst = Math.random() < 0.5;
    var mid = horizontalFirst ? { x: b.x, y: a.y } : { x: a.x, y: b.y };
    var seg1 = dist(a, mid);
    var seg2 = dist(mid, b);
    return {
      a: a, b: b, mid: mid,
      seg1: seg1, seg2: seg2, total: seg1 + seg2,
      pulses: []
    };
  }

  function pointAt(edge, t) {
    var d = t * edge.total;
    if (edge.total === 0) return edge.a;
    if (d <= edge.seg1) {
      var f = edge.seg1 === 0 ? 0 : d / edge.seg1;
      return { x: edge.a.x + (edge.mid.x - edge.a.x) * f, y: edge.a.y + (edge.mid.y - edge.a.y) * f };
    }
    var f2 = edge.seg2 === 0 ? 0 : (d - edge.seg1) / edge.seg2;
    return { x: edge.mid.x + (edge.b.x - edge.mid.x) * f2, y: edge.mid.y + (edge.b.y - edge.mid.y) * f2 };
  }

  function spawnPulse(edge) {
    edge.pulses.push({
      progress: 0,
      speed: rand(PULSE_SPEED[0], PULSE_SPEED[1]) / edge.total,
      color: pick(PULSE_COLORS),
      nextAt: null
    });
  }

  function scheduleNext(edge) {
    return performance.now() + rand(PULSE_INTERVAL[0], PULSE_INTERVAL[1]);
  }

  function buildLayout() {
    edges = [];

    var cols = Math.ceil(width / CELL) + 2;
    var rows = Math.ceil(height / CELL) + 2;
    var nodes = [];

    for (var r = 0; r < rows; r++) {
      nodes.push([]);
      for (var c = 0; c < cols; c++) {
        var jx = rand(-CELL * JITTER, CELL * JITTER);
        var jy = rand(-CELL * JITTER, CELL * JITTER);
        nodes[r].push({ x: c * CELL + jx, y: r * CELL + jy });
      }
    }

    for (var ri = 0; ri < rows; ri++) {
      for (var ci = 0; ci < cols; ci++) {
        if (ci < cols - 1 && Math.random() < CONNECT_PROB) {
          edges.push(makeEdge(nodes[ri][ci], nodes[ri][ci + 1]));
        }
        if (ri < rows - 1 && Math.random() < CONNECT_PROB) {
          edges.push(makeEdge(nodes[ri][ci], nodes[ri + 1][ci]));
        }
      }
    }

    // A handful of stub feedlines running straight off toward the edge,
    // like control/readout lines leaving the chip.
    for (var s = 0; s < STUB_COUNT; s++) {
      var er = Math.floor(rand(0, rows));
      var ec = Math.floor(rand(0, cols));
      var node = nodes[er] && nodes[er][ec];
      if (!node) continue;
      var dir = pick(["up", "down", "left", "right"]);
      var end = { x: node.x, y: node.y };
      var len = rand(60, 140);
      if (dir === "up") end = { x: node.x, y: node.y - len };
      if (dir === "down") end = { x: node.x, y: node.y + len };
      if (dir === "left") end = { x: node.x - len, y: node.y };
      if (dir === "right") end = { x: node.x + len, y: node.y };
      edges.push(makeEdge(node, end));
    }

    edges.forEach(function (edge) {
      edge.nextAt = scheduleNext(edge);
    });
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    var rect = canvas.parentElement.getBoundingClientRect();
    width = rect.width;
    height = rect.height;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    buildLayout();
  }

  function drawNode(p) {
    var alpha = clearFactor(p.x, p.y);
    if (alpha <= 0) return;
    var size = 9;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.rect(p.x - size / 2, p.y - size / 2, size, size);
    ctx.fillStyle = NODE_FILL;
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = NODE_STROKE;
    ctx.stroke();
    ctx.restore();
  }

  function drawEdgePath(edge) {
    var alpha = clearFactor(edge.mid.x, edge.mid.y);
    if (alpha <= 0) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.moveTo(edge.a.x, edge.a.y);
    ctx.lineTo(edge.mid.x, edge.mid.y);
    ctx.lineTo(edge.b.x, edge.b.y);
    ctx.strokeStyle = LINE_COLOR;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }

  function drawPulse(edge, pulse) {
    var p = pointAt(edge, pulse.progress);
    var alpha = clearFactor(p.x, p.y);
    if (alpha <= 0) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    var glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 10);
    glow.addColorStop(0, pulse.color);
    glow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.beginPath();
    ctx.fillStyle = glow;
    ctx.arc(p.x, p.y, 10, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.fillStyle = pulse.color;
    ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  var lastTime = null;

  function frame(now) {
    if (lastTime == null) lastTime = now;
    var dt = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;

    ctx.clearRect(0, 0, width, height);

    edges.forEach(function (edge) {
      drawEdgePath(edge);
    });

    var drawnNodes = {};
    edges.forEach(function (edge) {
      [edge.a, edge.b].forEach(function (p) {
        var k = Math.round(p.x) + "_" + Math.round(p.y);
        if (!drawnNodes[k]) {
          drawnNodes[k] = true;
          drawNode(p);
        }
      });
    });

    if (!reduceMotion) {
      edges.forEach(function (edge) {
        if (now >= edge.nextAt && edge.pulses.length < 2) {
          spawnPulse(edge);
          edge.nextAt = scheduleNext(edge);
        }
        edge.pulses.forEach(function (pulse) {
          pulse.progress += pulse.speed * dt;
        });
        edge.pulses = edge.pulses.filter(function (pulse) { return pulse.progress < 1; });
        edge.pulses.forEach(function (pulse) { drawPulse(edge, pulse); });
      });
    }

    raf = requestAnimationFrame(frame);
  }

  var raf = null;
  var resizeTimer = null;
  window.addEventListener("resize", function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 150);
  });

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) {
      if (raf) cancelAnimationFrame(raf);
      raf = null;
      lastTime = null;
    } else if (!raf) {
      raf = requestAnimationFrame(frame);
    }
  });

  resize();
  raf = requestAnimationFrame(frame);
})();
