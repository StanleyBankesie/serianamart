"use strict";

function _typeof(o) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, _typeof(o); }
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = ServiceConfirmationForm;
var _react = _interopRequireWildcard(require("react"));
var _reactRouterDom = require("react-router-dom");
var _client = require("../../../../api/client");
function _interopRequireWildcard(e, t) { if ("function" == typeof WeakMap) var r = new WeakMap(), n = new WeakMap(); return (_interopRequireWildcard = function _interopRequireWildcard(e, t) { if (!t && e && e.__esModule) return e; var o, i, f = { __proto__: null, "default": e }; if (null === e || "object" != _typeof(e) && "function" != typeof e) return f; if (o = t ? n : r) { if (o.has(e)) return o.get(e); o.set(e, f); } for (var _t3 in e) "default" !== _t3 && {}.hasOwnProperty.call(e, _t3) && ((i = (o = Object.defineProperty) && Object.getOwnPropertyDescriptor(e, _t3)) && (i.get || i.set) ? o(f, _t3, i) : f[_t3] = e[_t3]); return f; })(e, t); }
function _regenerator() { /*! regenerator-runtime -- Copyright (c) 2014-present, Facebook, Inc. -- license (MIT): https://github.com/babel/babel/blob/main/packages/babel-helpers/LICENSE */ var e, t, r = "function" == typeof Symbol ? Symbol : {}, n = r.iterator || "@@iterator", o = r.toStringTag || "@@toStringTag"; function i(r, n, o, i) { var c = n && n.prototype instanceof Generator ? n : Generator, u = Object.create(c.prototype); return _regeneratorDefine2(u, "_invoke", function (r, n, o) { var i, c, u, f = 0, p = o || [], y = !1, G = { p: 0, n: 0, v: e, a: d, f: d.bind(e, 4), d: function d(t, r) { return i = t, c = 0, u = e, G.n = r, a; } }; function d(r, n) { for (c = r, u = n, t = 0; !y && f && !o && t < p.length; t++) { var o, i = p[t], d = G.p, l = i[2]; r > 3 ? (o = l === n) && (u = i[(c = i[4]) ? 5 : (c = 3, 3)], i[4] = i[5] = e) : i[0] <= d && ((o = r < 2 && d < i[1]) ? (c = 0, G.v = n, G.n = i[1]) : d < l && (o = r < 3 || i[0] > n || n > l) && (i[4] = r, i[5] = n, G.n = l, c = 0)); } if (o || r > 1) return a; throw y = !0, n; } return function (o, p, l) { if (f > 1) throw TypeError("Generator is already running"); for (y && 1 === p && d(p, l), c = p, u = l; (t = c < 2 ? e : u) || !y;) { i || (c ? c < 3 ? (c > 1 && (G.n = -1), d(c, u)) : G.n = u : G.v = u); try { if (f = 2, i) { if (c || (o = "next"), t = i[o]) { if (!(t = t.call(i, u))) throw TypeError("iterator result is not an object"); if (!t.done) return t; u = t.value, c < 2 && (c = 0); } else 1 === c && (t = i["return"]) && t.call(i), c < 2 && (u = TypeError("The iterator does not provide a '" + o + "' method"), c = 1); i = e; } else if ((t = (y = G.n < 0) ? u : r.call(n, G)) !== a) break; } catch (t) { i = e, c = 1, u = t; } finally { f = 1; } } return { value: t, done: y }; }; }(r, o, i), !0), u; } var a = {}; function Generator() {} function GeneratorFunction() {} function GeneratorFunctionPrototype() {} t = Object.getPrototypeOf; var c = [][n] ? t(t([][n]())) : (_regeneratorDefine2(t = {}, n, function () { return this; }), t), u = GeneratorFunctionPrototype.prototype = Generator.prototype = Object.create(c); function f(e) { return Object.setPrototypeOf ? Object.setPrototypeOf(e, GeneratorFunctionPrototype) : (e.__proto__ = GeneratorFunctionPrototype, _regeneratorDefine2(e, o, "GeneratorFunction")), e.prototype = Object.create(u), e; } return GeneratorFunction.prototype = GeneratorFunctionPrototype, _regeneratorDefine2(u, "constructor", GeneratorFunctionPrototype), _regeneratorDefine2(GeneratorFunctionPrototype, "constructor", GeneratorFunction), GeneratorFunction.displayName = "GeneratorFunction", _regeneratorDefine2(GeneratorFunctionPrototype, o, "GeneratorFunction"), _regeneratorDefine2(u), _regeneratorDefine2(u, o, "Generator"), _regeneratorDefine2(u, n, function () { return this; }), _regeneratorDefine2(u, "toString", function () { return "[object Generator]"; }), (_regenerator = function _regenerator() { return { w: i, m: f }; })(); }
function _regeneratorDefine2(e, r, n, t) { var i = Object.defineProperty; try { i({}, "", {}); } catch (e) { i = 0; } _regeneratorDefine2 = function _regeneratorDefine(e, r, n, t) { function o(r, n) { _regeneratorDefine2(e, r, function (e) { return this._invoke(r, n, e); }); } r ? i ? i(e, r, { value: n, enumerable: !t, configurable: !t, writable: !t }) : e[r] = n : (o("next", 0), o("throw", 1), o("return", 2)); }, _regeneratorDefine2(e, r, n, t); }
function _toConsumableArray(r) { return _arrayWithoutHoles(r) || _iterableToArray(r) || _unsupportedIterableToArray(r) || _nonIterableSpread(); }
function _nonIterableSpread() { throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }
function _iterableToArray(r) { if ("undefined" != typeof Symbol && null != r[Symbol.iterator] || null != r["@@iterator"]) return Array.from(r); }
function _arrayWithoutHoles(r) { if (Array.isArray(r)) return _arrayLikeToArray(r); }
function asyncGeneratorStep(n, t, e, r, o, a, c) { try { var i = n[a](c), u = i.value; } catch (n) { return void e(n); } i.done ? t(u) : Promise.resolve(u).then(r, o); }
function _asyncToGenerator(n) { return function () { var t = this, e = arguments; return new Promise(function (r, o) { var a = n.apply(t, e); function _next(n) { asyncGeneratorStep(a, r, o, _next, _throw, "next", n); } function _throw(n) { asyncGeneratorStep(a, r, o, _next, _throw, "throw", n); } _next(void 0); }); }; }
function _createForOfIteratorHelper(r, e) { var t = "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"]; if (!t) { if (Array.isArray(r) || (t = _unsupportedIterableToArray(r)) || e && r && "number" == typeof r.length) { t && (r = t); var _n = 0, F = function F() {}; return { s: F, n: function n() { return _n >= r.length ? { done: !0 } : { done: !1, value: r[_n++] }; }, e: function e(r) { throw r; }, f: F }; } throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); } var o, a = !0, u = !1; return { s: function s() { t = t.call(r); }, n: function n() { var r = t.next(); return a = r.done, r; }, e: function e(r) { u = !0, o = r; }, f: function f() { try { a || null == t["return"] || t["return"](); } finally { if (u) throw o; } } }; }
function ownKeys(e, r) { var t = Object.keys(e); if (Object.getOwnPropertySymbols) { var o = Object.getOwnPropertySymbols(e); r && (o = o.filter(function (r) { return Object.getOwnPropertyDescriptor(e, r).enumerable; })), t.push.apply(t, o); } return t; }
function _objectSpread(e) { for (var r = 1; r < arguments.length; r++) { var t = null != arguments[r] ? arguments[r] : {}; r % 2 ? ownKeys(Object(t), !0).forEach(function (r) { _defineProperty(e, r, t[r]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys(Object(t)).forEach(function (r) { Object.defineProperty(e, r, Object.getOwnPropertyDescriptor(t, r)); }); } return e; }
function _defineProperty(e, r, t) { return (r = _toPropertyKey(r)) in e ? Object.defineProperty(e, r, { value: t, enumerable: !0, configurable: !0, writable: !0 }) : e[r] = t, e; }
function _toPropertyKey(t) { var i = _toPrimitive(t, "string"); return "symbol" == _typeof(i) ? i : i + ""; }
function _toPrimitive(t, r) { if ("object" != _typeof(t) || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != _typeof(i)) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }
function _slicedToArray(r, e) { return _arrayWithHoles(r) || _iterableToArrayLimit(r, e) || _unsupportedIterableToArray(r, e) || _nonIterableRest(); }
function _nonIterableRest() { throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }
function _unsupportedIterableToArray(r, a) { if (r) { if ("string" == typeof r) return _arrayLikeToArray(r, a); var t = {}.toString.call(r).slice(8, -1); return "Object" === t && r.constructor && (t = r.constructor.name), "Map" === t || "Set" === t ? Array.from(r) : "Arguments" === t || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(t) ? _arrayLikeToArray(r, a) : void 0; } }
function _arrayLikeToArray(r, a) { (null == a || a > r.length) && (a = r.length); for (var e = 0, n = Array(a); e < a; e++) n[e] = r[e]; return n; }
function _iterableToArrayLimit(r, l) { var t = null == r ? null : "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"]; if (null != t) { var e, n, i, u, a = [], f = !0, o = !1; try { if (i = (t = t.call(r)).next, 0 === l) { if (Object(t) !== t) return; f = !1; } else for (; !(f = (e = i.call(t)).done) && (a.push(e.value), a.length !== l); f = !0); } catch (r) { o = !0, n = r; } finally { try { if (!f && null != t["return"] && (u = t["return"](), Object(u) !== u)) return; } finally { if (o) throw n; } } return a; } }
function _arrayWithHoles(r) { if (Array.isArray(r)) return r; }
function toISODate(v) {
  if (!v) return "";
  try {
    return new Date(v).toISOString().slice(0, 10);
  } catch (_unused) {
    return "";
  }
}
function ServiceConfirmationForm() {
  var _formData$details;
  var _useParams = (0, _reactRouterDom.useParams)(),
    id = _useParams.id;
  var _useLocation = (0, _reactRouterDom.useLocation)(),
    search = _useLocation.search;
  var navigate = (0, _reactRouterDom.useNavigate)();
  var isNew = !id || id === "new";
  var urlParams = new URLSearchParams(search);
  var qOrderId = urlParams.get("order_id");
  var qExecutionId = urlParams.get("execution_id");
  var _useState = (0, _react.useState)(null),
    _useState2 = _slicedToArray(_useState, 2),
    modeOverride = _useState2[0],
    setModeOverride = _useState2[1];
  var actualMode = modeOverride || urlParams.get("mode") || (isNew ? "edit" : "view");
  var isView = actualMode === "view" || (formData === null || formData === void 0 ? void 0 : formData.status) === "APPROVED";
  var _useState3 = (0, _react.useState)(new Date()),
    _useState4 = _slicedToArray(_useState3, 2),
    now = _useState4[0],
    setNow = _useState4[1];
  var _useState5 = (0, _react.useState)(false),
    _useState6 = _slicedToArray(_useState5, 2),
    loading = _useState6[0],
    setLoading = _useState6[1];
  var _useState7 = (0, _react.useState)(false),
    _useState8 = _slicedToArray(_useState7, 2),
    saving = _useState8[0],
    setSaving = _useState8[1];
  var _useState9 = (0, _react.useState)(""),
    _useState0 = _slicedToArray(_useState9, 2),
    error = _useState0[0],
    setError = _useState0[1];
  var _useState1 = (0, _react.useState)([]),
    _useState10 = _slicedToArray(_useState1, 2),
    suppliers = _useState10[0],
    setSuppliers = _useState10[1];
  var _useState11 = (0, _react.useState)([]),
    _useState12 = _slicedToArray(_useState11, 2),
    executions = _useState12[0],
    setExecutions = _useState12[1];
  var _useState13 = (0, _react.useState)(""),
    _useState14 = _slicedToArray(_useState13, 2),
    selectedExecutionId = _useState14[0],
    setSelectedExecutionId = _useState14[1];
  var selectedExecution = (0, _react.useMemo)(function () {
    return executions.find(function (x) {
      return String(x.id) === String(selectedExecutionId);
    });
  }, [executions, selectedExecutionId]);
  var _useState15 = (0, _react.useState)({
      order_id: "",
      execution_id: "",
      sc_no: "",
      sc_date: toISODate(new Date()),
      supplier_id: "",
      status: "DRAFT",
      remarks: "",
      details: []
    }),
    _useState16 = _slicedToArray(_useState15, 2),
    formData = _useState16[0],
    setFormData = _useState16[1];
  var _useState17 = (0, _react.useState)(""),
    _useState18 = _slicedToArray(_useState17, 2),
    appointmentTime = _useState18[0],
    setAppointmentTime = _useState18[1];
  var _useState19 = (0, _react.useState)(0),
    _useState20 = _slicedToArray(_useState19, 2),
    depositPercent = _useState20[0],
    setDepositPercent = _useState20[1];
  var _useState21 = (0, _react.useState)(""),
    _useState22 = _slicedToArray(_useState21, 2),
    customerName = _useState22[0],
    setCustomerName = _useState22[1];
  var _useState23 = (0, _react.useState)(""),
    _useState24 = _slicedToArray(_useState23, 2),
    customerEmail = _useState24[0],
    setCustomerEmail = _useState24[1];
  var _useState25 = (0, _react.useState)(""),
    _useState26 = _slicedToArray(_useState25, 2),
    customerPhone = _useState26[0],
    setCustomerPhone = _useState26[1];
  var _useState27 = (0, _react.useState)(false),
    _useState28 = _slicedToArray(_useState27, 2),
    accept1 = _useState28[0],
    setAccept1 = _useState28[1];
  var _useState29 = (0, _react.useState)(false),
    _useState30 = _slicedToArray(_useState29, 2),
    accept2 = _useState30[0],
    setAccept2 = _useState30[1];
  var _useState31 = (0, _react.useState)(false),
    _useState32 = _slicedToArray(_useState31, 2),
    accept3 = _useState32[0],
    setAccept3 = _useState32[1];
  var _useState33 = (0, _react.useState)(false),
    _useState34 = _slicedToArray(_useState33, 2),
    accept4 = _useState34[0],
    setAccept4 = _useState34[1];
  var _useState35 = (0, _react.useState)(false),
    _useState36 = _slicedToArray(_useState35, 2),
    accept5 = _useState36[0],
    setAccept5 = _useState36[1];
  var _useState37 = (0, _react.useState)(""),
    _useState38 = _slicedToArray(_useState37, 2),
    satisfaction = _useState38[0],
    setSatisfaction = _useState38[1];
  var _useState39 = (0, _react.useState)(""),
    _useState40 = _slicedToArray(_useState39, 2),
    customerFeedback = _useState40[0],
    setCustomerFeedback = _useState40[1];
  var _useState41 = (0, _react.useState)(false),
    _useState42 = _slicedToArray(_useState41, 2),
    warrantyProvided = _useState42[0],
    setWarrantyProvided = _useState42[1];
  var _useState43 = (0, _react.useState)(false),
    _useState44 = _slicedToArray(_useState43, 2),
    followUpRequired = _useState44[0],
    setFollowUpRequired = _useState44[1];
  var _useState45 = (0, _react.useState)(""),
    _useState46 = _slicedToArray(_useState45, 2),
    followUpNotes = _useState46[0],
    setFollowUpNotes = _useState46[1];
  var _useState47 = (0, _react.useState)(""),
    _useState48 = _slicedToArray(_useState47, 2),
    additionalNotes = _useState48[0],
    setAdditionalNotes = _useState48[1];
  var _useState49 = (0, _react.useState)(false),
    _useState50 = _slicedToArray(_useState49, 2),
    showRejectModal = _useState50[0],
    setShowRejectModal = _useState50[1];
  var _useState51 = (0, _react.useState)(""),
    _useState52 = _slicedToArray(_useState51, 2),
    rejectionReason = _useState52[0],
    setRejectionReason = _useState52[1];
  var readyToConfirm = (0, _react.useMemo)(function () {
    var checksOk = accept1 && accept2 && accept3 && accept4 && accept5;
    var hasSatisfaction = !!satisfaction;
    var hasExec = !!selectedExecutionId;
    var hasSupplier = !!formData.supplier_id;
    var hasDate = !!formData.sc_date;
    return checksOk && hasSatisfaction && hasExec && hasSupplier && hasDate;
  }, [accept1, accept2, accept3, accept4, accept5, satisfaction, selectedExecutionId, formData.supplier_id, formData.sc_date]);
  (0, _react.useEffect)(function () {
    var mounted = true;
    _client.api.get("/purchase/suppliers", {
      params: {
        contractor: "Y"
      }
    }).then(function (res) {
      var _res$data;
      if (!mounted) return;
      var rows = Array.isArray((_res$data = res.data) === null || _res$data === void 0 ? void 0 : _res$data.items) ? res.data.items : [];
      var filtered = rows.filter(function (s) {
        return String(s.service_contractor || "").toUpperCase() === "Y";
      });
      setSuppliers(filtered);
    })["catch"](function (e) {
      var _e$response;
      if (!mounted) return;
      setError((e === null || e === void 0 || (_e$response = e.response) === null || _e$response === void 0 || (_e$response = _e$response.data) === null || _e$response === void 0 ? void 0 : _e$response.message) || "Failed to load suppliers");
    });
    _client.api.get("/purchase/service-orders", {
      params: {
        type: "EXTERNAL"
      }
    }).then(function (res) {
      var _res$data2;
      if (!mounted) return;
      var arr = Array.isArray((_res$data2 = res.data) === null || _res$data2 === void 0 ? void 0 : _res$data2.items) ? res.data.items : [];
      var mapped = arr.map(function (x) {
        return {
          id: x.id,
          order_no: x.order_no,
          status: x.status || "",
          assigned_supervisor_username: x.assigned_supervisor_username || "",
          order_date: x.order_date || ""
        };
      });
      setExecutions(mapped);
    })["catch"](function () {
      if (!mounted) return;
      setExecutions([]);
    });
    return function () {
      mounted = false;
    };
  }, []);
  (0, _react.useEffect)(function () {
    var t = setInterval(function () {
      return setNow(new Date());
    }, 1000);
    return function () {
      return clearInterval(t);
    };
  }, []);
  (0, _react.useEffect)(function () {
    if (isNew) return;
    var mounted = true;
    setLoading(true);
    setError("");
    _client.api.get("/purchase/service-confirmations/".concat(id)).then(function (res) {
      var _res$data3, _res$data4;
      if (!mounted) return;
      var c = (_res$data3 = res.data) === null || _res$data3 === void 0 ? void 0 : _res$data3.item;
      var details = Array.isArray((_res$data4 = res.data) === null || _res$data4 === void 0 ? void 0 : _res$data4.details) ? res.data.details : [];
      if (!c) return;
      setFormData({
        sc_no: c.sc_no || "",
        sc_date: toISODate(c.sc_date),
        supplier_id: c.supplier_id ? String(c.supplier_id) : "",
        order_id: c.order_id ? String(c.order_id) : "",
        execution_id: c.execution_id ? String(c.execution_id) : "",
        status: c.status || "DRAFT",
        remarks: c.remarks || "",
        details: details.map(function (d) {
          var _d$qty, _d$unit_price;
          return {
            description: d.description || "",
            qty: (_d$qty = d.qty) !== null && _d$qty !== void 0 ? _d$qty : "",
            unit_price: (_d$unit_price = d.unit_price) !== null && _d$unit_price !== void 0 ? _d$unit_price : ""
          };
        })
      });
    })["catch"](function (e) {
      var _e$response2;
      if (!mounted) return;
      setError((e === null || e === void 0 || (_e$response2 = e.response) === null || _e$response2 === void 0 || (_e$response2 = _e$response2.data) === null || _e$response2 === void 0 ? void 0 : _e$response2.message) || "Failed to load service confirmation");
    })["finally"](function () {
      if (!mounted) return;
      setLoading(false);
    });
    return function () {
      mounted = false;
    };
  }, [id, isNew]);
  (0, _react.useEffect)(function () {
    if (!isNew) return;
    if (qOrderId) {
      setLoading(true);
      _client.api.get("/purchase/service-orders/".concat(qOrderId)).then(function (res) {
        var _res$data5, _res$data6;
        var o = (_res$data5 = res.data) === null || _res$data5 === void 0 ? void 0 : _res$data5.item;
        var details = ((_res$data6 = res.data) === null || _res$data6 === void 0 ? void 0 : _res$data6.details) || [];
        if (o) {
          setFormData(function (prev) {
            return _objectSpread(_objectSpread({}, prev), {}, {
              order_id: String(o.id),
              supplier_id: o.customer_id ? String(o.customer_id) : prev.supplier_id,
              // Orders use customer_id as supplier_id if it's external, or maybe we need to find supplier? Actually service orders have customer_id. For confirmation, it expects supplier_id. The list page shows "customer_name" for orders. But the schema says supplier_id.
              details: details.map(function (d) {
                return {
                  description: d.description || d.item_name || "",
                  qty: d.qty || "",
                  unit_price: d.unit_price || ""
                };
              })
            });
          });
        }
      })["finally"](function () {
        return setLoading(false);
      });
    } else if (qExecutionId) {
      setLoading(true);
      _client.api.get("/purchase/service-executions/".concat(qExecutionId)).then(function (res) {
        var _res$data7, _res$data8;
        var e = (_res$data7 = res.data) === null || _res$data7 === void 0 ? void 0 : _res$data7.item;
        var materials = ((_res$data8 = res.data) === null || _res$data8 === void 0 ? void 0 : _res$data8.materials) || [];
        if (e) {
          setFormData(function (prev) {
            return _objectSpread(_objectSpread({}, prev), {}, {
              execution_id: String(e.id),
              order_id: e.order_id ? String(e.order_id) : "",
              details: materials.map(function (m) {
                return {
                  description: m.name || m.note || "",
                  qty: m.qty || "",
                  unit_price: ""
                };
              })
            });
          });
        }
      })["finally"](function () {
        return setLoading(false);
      });
    }
  }, [isNew, qOrderId, qExecutionId]);
  var servicesCatalog = (0, _react.useMemo)(function () {
    return [{
      key: "diagnosis",
      name: "Diagnosis",
      icon: "🔎",
      price: 50
    }, {
      key: "repair",
      name: "Repair",
      icon: "🛠️",
      price: 150
    }, {
      key: "maintenance",
      name: "Maintenance",
      icon: "🔧",
      price: 100
    }, {
      key: "installation",
      name: "Installation",
      icon: "⚙️",
      price: 200
    }, {
      key: "consultation",
      name: "Consultation",
      icon: "💬",
      price: 75
    }, {
      key: "upgrade",
      name: "Upgrade",
      icon: "⬆️",
      price: 220
    }];
  }, []);
  var computedTotal = (0, _react.useMemo)(function () {
    var lines = formData.details || [];
    var total = 0;
    var _iterator = _createForOfIteratorHelper(lines),
      _step;
    try {
      for (_iterator.s(); !(_step = _iterator.n()).done;) {
        var d = _step.value;
        var qty = Number(d.qty);
        var unitPrice = Number(d.unit_price);
        if (!Number.isFinite(qty) || !Number.isFinite(unitPrice)) continue;
        total += qty * unitPrice;
      }
    } catch (err) {
      _iterator.e(err);
    } finally {
      _iterator.f();
    }
    return total;
  }, [formData.details]);
  var tax = (0, _react.useMemo)(function () {
    return computedTotal * 0.125;
  }, [computedTotal]);
  var grandTotal = (0, _react.useMemo)(function () {
    return computedTotal + tax;
  }, [computedTotal, tax]);
  var depositAmount = (0, _react.useMemo)(function () {
    return grandTotal * (Number(depositPercent) / 100);
  }, [grandTotal, depositPercent]);
  function handlePrint() {
    window.print();
  }
  function handleDownload() {
    alert("Downloading confirmation PDF (demo)");
  }
  function handleShare() {
    return _handleShare.apply(this, arguments);
  }
  function _handleShare() {
    _handleShare = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee2() {
      var _t2;
      return _regenerator().w(function (_context2) {
        while (1) switch (_context2.p = _context2.n) {
          case 0:
            _context2.p = 0;
            _context2.n = 1;
            return navigator.clipboard.writeText(window.location.href);
          case 1:
            alert("Link copied to clipboard");
            _context2.n = 3;
            break;
          case 2:
            _context2.p = 2;
            _t2 = _context2.v;
            alert("Unable to copy link");
          case 3:
            return _context2.a(2);
        }
      }, _callee2, null, [[0, 2]]);
    }));
    return _handleShare.apply(this, arguments);
  }
  var addLine = function addLine() {
    setFormData(function (prev) {
      return _objectSpread(_objectSpread({}, prev), {}, {
        details: [].concat(_toConsumableArray(prev.details), [{
          description: "",
          qty: "",
          unit_price: ""
        }])
      });
    });
  };
  var removeLine = function removeLine(idx) {
    setFormData(function (prev) {
      return _objectSpread(_objectSpread({}, prev), {}, {
        details: prev.details.filter(function (_, i) {
          return i !== idx;
        })
      });
    });
  };
  var updateLine = function updateLine(idx, patch) {
    setFormData(function (prev) {
      return _objectSpread(_objectSpread({}, prev), {}, {
        details: prev.details.map(function (d, i) {
          return i === idx ? _objectSpread(_objectSpread({}, d), patch) : d;
        })
      });
    });
  };
  var toggleService = function toggleService(svc) {
    var existsIdx = formData.details.findIndex(function (d) {
      return String(d.description || "").trim() === svc.name;
    });
    if (existsIdx >= 0) {
      removeLine(existsIdx);
      return;
    }
    setFormData(function (prev) {
      return _objectSpread(_objectSpread({}, prev), {}, {
        details: [].concat(_toConsumableArray(prev.details), [{
          description: svc.name,
          qty: 1,
          unit_price: svc.price
        }])
      });
    });
  };
  var isServiceSelected = function isServiceSelected(svc) {
    return formData.details.some(function (d) {
      return String(d.description || "").trim() === svc.name;
    });
  };
  var handleSubmit = /*#__PURE__*/function () {
    var _ref = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee(e) {
      var payload, _e2$response, _t;
      return _regenerator().w(function (_context) {
        while (1) switch (_context.p = _context.n) {
          case 0:
            if (e && typeof e.preventDefault === "function") e.preventDefault();
            setSaving(true);
            setError("");
            _context.p = 1;
            if (selectedExecutionId) {
              _context.n = 2;
              break;
            }
            throw new Error("Select completed external service order");
          case 2:
            if (accept1 && accept2 && accept3 && accept4 && accept5) {
              _context.n = 3;
              break;
            }
            throw new Error("Check all acceptance items");
          case 3:
            if (satisfaction) {
              _context.n = 4;
              break;
            }
            throw new Error("Select satisfaction rating");
          case 4:
            payload = {
              sc_no: formData.sc_no || "SC-".concat(String(Math.floor(Math.random() * 1000000)).padStart(6, "0")),
              sc_date: formData.sc_date,
              supplier_id: formData.supplier_id ? Number(formData.supplier_id) : null,
              status: "APPROVED",
              remarks: (formData.remarks || "") + (additionalNotes ? "\nNotes: ".concat(additionalNotes) : "") + (warrantyProvided ? "\nWarranty provided" : "") + (followUpRequired && followUpNotes ? "\nFollow-up: ".concat(followUpNotes) : ""),
              details: (formData.details || []).map(function (d) {
                return {
                  description: String(d.description || "").trim(),
                  qty: d.qty === "" ? null : Number(d.qty),
                  unit_price: d.unit_price === "" ? null : Number(d.unit_price)
                };
              }),
              satisfaction: Number(satisfaction),
              customer_feedback: customerFeedback || null
            };
            if (!(!payload.sc_date || !payload.supplier_id)) {
              _context.n = 5;
              break;
            }
            throw new Error("Date and supplier are required");
          case 5:
            if (!isNew) {
              _context.n = 7;
              break;
            }
            _context.n = 6;
            return _client.api.post("/purchase/service-confirmations", payload);
          case 6:
            _context.n = 8;
            break;
          case 7:
            _context.n = 8;
            return _client.api.put("/purchase/service-confirmations/".concat(id), payload);
          case 8:
            navigate("/service-management/service-confirmation");
            _context.n = 10;
            break;
          case 9:
            _context.p = 9;
            _t = _context.v;
            setError((_t === null || _t === void 0 || (_e2$response = _t.response) === null || _e2$response === void 0 || (_e2$response = _e2$response.data) === null || _e2$response === void 0 ? void 0 : _e2$response.message) || (_t === null || _t === void 0 ? void 0 : _t.message) || "Failed to save service confirmation");
          case 10:
            _context.p = 10;
            setSaving(false);
            return _context.f(10);
          case 11:
            return _context.a(2);
        }
      }, _callee, null, [[1, 9, 10, 11]]);
    }));
    return function handleSubmit(_x) {
      return _ref.apply(this, arguments);
    };
  }();
  var supplierName = (0, _react.useMemo)(function () {
    var sid = formData.supplier_id ? Number(formData.supplier_id) : null;
    if (!sid) return "";
    var s = suppliers.find(function (x) {
      return Number(x.id) === sid;
    });
    return s ? s.supplier_name || "" : "";
  }, [formData.supplier_id, suppliers]);
  var resetForm = function resetForm() {
    setFormData({
      sc_no: "",
      sc_date: toISODate(new Date()),
      supplier_id: "",
      status: "DRAFT",
      remarks: "",
      details: []
    });
    setAppointmentTime("");
    setDepositPercent(0);
  };
  if (isView && !isNew) {
    return /*#__PURE__*/_react["default"].createElement("div", {
      className: "space-y-6"
    }, /*#__PURE__*/_react["default"].createElement("div", {
      className: "text-center mb-4"
    }, /*#__PURE__*/_react["default"].createElement("div", {
      className: "flex justify-center mb-2"
    }, /*#__PURE__*/_react["default"].createElement("div", {
      className: "bg-green-100 rounded-full p-3"
    }, /*#__PURE__*/_react["default"].createElement("span", {
      className: "text-3xl"
    }, "\u2713"))), /*#__PURE__*/_react["default"].createElement("div", {
      className: "text-2xl font-bold",
      style: {
        color: "#0E3646"
      }
    }, "Service Confirmation"), /*#__PURE__*/_react["default"].createElement("div", {
      className: "text-sm mt-1"
    }, "Confirmation saved successfully")), /*#__PURE__*/_react["default"].createElement("div", {
      className: "bg-white rounded-2xl shadow-lg p-6 mb-4 border-l-4",
      style: {
        borderLeftColor: "#0E3646"
      }
    }, /*#__PURE__*/_react["default"].createElement("div", {
      className: "flex flex-col md:flex-row md:items-center md:justify-between gap-4"
    }, /*#__PURE__*/_react["default"].createElement("div", null, /*#__PURE__*/_react["default"].createElement("div", {
      className: "text-xs text-slate-500"
    }, "Confirmation Number"), /*#__PURE__*/_react["default"].createElement("div", {
      className: "text-xl font-bold",
      style: {
        color: "#0E3646"
      }
    }, formData.sc_no || "-")), /*#__PURE__*/_react["default"].createElement("div", {
      className: "flex flex-wrap gap-2"
    }, /*#__PURE__*/_react["default"].createElement("button", {
      type: "button",
      className: "flex items-center gap-2 px-3 py-2 border-2 border-slate-200 rounded-lg hover:bg-slate-50 transition-colors",
      onClick: handlePrint
    }, "\uD83D\uDDA8\uFE0F ", /*#__PURE__*/_react["default"].createElement("span", {
      className: "text-sm font-medium"
    }, "Print")), /*#__PURE__*/_react["default"].createElement("button", {
      type: "button",
      className: "flex items-center gap-2 px-3 py-2 border-2 border-slate-200 rounded-lg hover:bg-slate-50 transition-colors",
      onClick: handleDownload
    }, "\uD83D\uDCC4 ", /*#__PURE__*/_react["default"].createElement("span", {
      className: "text-sm font-medium"
    }, "Download")), /*#__PURE__*/_react["default"].createElement("button", {
      type: "button",
      className: "flex items-center gap-2 px-3 py-2 border-2 border-slate-200 rounded-lg hover:bg-slate-50 transition-colors",
      onClick: handleShare
    }, "\uD83D\uDD17 ", /*#__PURE__*/_react["default"].createElement("span", {
      className: "text-sm font-medium"
    }, "Share"))))), /*#__PURE__*/_react["default"].createElement("div", {
      className: "card"
    }, /*#__PURE__*/_react["default"].createElement("div", {
      className: "card-header bg-brand text-white rounded-t-lg"
    }, /*#__PURE__*/_react["default"].createElement("div", {
      className: "flex justify-between items-center"
    }, /*#__PURE__*/_react["default"].createElement("div", {
      className: "font-semibold"
    }, "Status"), /*#__PURE__*/_react["default"].createElement("span", {
      className: "badge badge-info"
    }, formData.status || "DRAFT"))), /*#__PURE__*/_react["default"].createElement("div", {
      className: "card-body grid grid-cols-1 md:grid-cols-2 gap-6"
    }, /*#__PURE__*/_react["default"].createElement("div", null, /*#__PURE__*/_react["default"].createElement("div", {
      className: "text-xs text-slate-500"
    }, "Supplier"), /*#__PURE__*/_react["default"].createElement("div", {
      className: "font-semibold"
    }, supplierName || "-")), /*#__PURE__*/_react["default"].createElement("div", null, /*#__PURE__*/_react["default"].createElement("div", {
      className: "text-xs text-slate-500"
    }, "Appointment"), /*#__PURE__*/_react["default"].createElement("div", {
      className: "font-semibold"
    }, formData.sc_date || "-")), /*#__PURE__*/_react["default"].createElement("div", {
      className: "md:col-span-2"
    }, /*#__PURE__*/_react["default"].createElement("div", {
      className: "text-xs text-slate-500"
    }, "Remarks"), /*#__PURE__*/_react["default"].createElement("div", {
      className: "font-semibold"
    }, formData.remarks || "-")))), /*#__PURE__*/_react["default"].createElement("div", {
      className: "card"
    }, /*#__PURE__*/_react["default"].createElement("div", {
      className: "card-header bg-brand text-white rounded-t-lg"
    }, /*#__PURE__*/_react["default"].createElement("div", {
      className: "font-semibold"
    }, "Selected Services")), /*#__PURE__*/_react["default"].createElement("div", {
      className: "card-body"
    }, !formData.details.length ? /*#__PURE__*/_react["default"].createElement("div", {
      className: "text-center text-slate-600 p-6"
    }, /*#__PURE__*/_react["default"].createElement("div", {
      className: "text-3xl"
    }, "\uD83D\uDD27"), /*#__PURE__*/_react["default"].createElement("div", {
      className: "text-sm mt-2"
    }, "No services selected")) : /*#__PURE__*/_react["default"].createElement("div", {
      className: "space-y-2"
    }, formData.details.map(function (d, idx) {
      var qty = Math.max(1, Number(d.qty || 1));
      var unit = Number(d.unit_price || 0);
      var amount = qty * unit;
      return /*#__PURE__*/_react["default"].createElement("div", {
        key: idx,
        className: "p-3 rounded-lg border border-slate-200 bg-white"
      }, /*#__PURE__*/_react["default"].createElement("div", {
        className: "flex justify-between items-center"
      }, /*#__PURE__*/_react["default"].createElement("div", {
        className: "font-medium text-brand-700"
      }, d.description), /*#__PURE__*/_react["default"].createElement("div", {
        className: "font-semibold"
      }, "GH\u20B5 ".concat(amount.toFixed(2)))), /*#__PURE__*/_react["default"].createElement("div", {
        className: "text-xs text-slate-600"
      }, "GH\u20B5 ".concat(unit.toFixed(2), " \xD7 ").concat(qty)));
    })))), /*#__PURE__*/_react["default"].createElement("div", {
      className: "card"
    }, /*#__PURE__*/_react["default"].createElement("div", {
      className: "card-header bg-brand text-white rounded-t-lg"
    }, /*#__PURE__*/_react["default"].createElement("div", {
      className: "font-semibold"
    }, "Totals")), /*#__PURE__*/_react["default"].createElement("div", {
      className: "card-body space-y-2"
    }, /*#__PURE__*/_react["default"].createElement("div", {
      className: "flex justify-between"
    }, /*#__PURE__*/_react["default"].createElement("div", null, "Services Subtotal"), /*#__PURE__*/_react["default"].createElement("div", null, "GH\u20B5 ".concat(computedTotal.toFixed(2)))), /*#__PURE__*/_react["default"].createElement("div", {
      className: "flex justify-between"
    }, /*#__PURE__*/_react["default"].createElement("div", null, "Tax (12.5%)"), /*#__PURE__*/_react["default"].createElement("div", null, "GH\u20B5 ".concat(tax.toFixed(2)))), /*#__PURE__*/_react["default"].createElement("div", {
      className: "flex justify-between border-t pt-2 font-bold"
    }, /*#__PURE__*/_react["default"].createElement("div", null, "Total"), /*#__PURE__*/_react["default"].createElement("div", null, "GH\u20B5 ".concat(grandTotal.toFixed(2)))))), /*#__PURE__*/_react["default"].createElement("div", {
      className: "flex gap-2"
    }, /*#__PURE__*/_react["default"].createElement(_reactRouterDom.Link, {
      to: "/purchase/service-confirmation",
      className: "btn-secondary"
    }, "Back to List"), /*#__PURE__*/_react["default"].createElement("button", {
      type: "button",
      className: "btn-primary",
      onClick: function onClick() {
        return navigate("/purchase/service-confirmation/".concat(id, "?mode=edit"));
      }
    }, "Edit Confirmation")));
  }
  return /*#__PURE__*/_react["default"].createElement("div", {
    className: "space-y-6"
  }, /*#__PURE__*/_react["default"].createElement("div", {
    className: "card"
  }, /*#__PURE__*/_react["default"].createElement("div", {
    className: "card-header bg-brand text-white rounded-t-lg"
  }, /*#__PURE__*/_react["default"].createElement("div", {
    className: "flex justify-between items-center text-white"
  }, /*#__PURE__*/_react["default"].createElement("div", {
    className: "flex items-center gap-3"
  }, /*#__PURE__*/_react["default"].createElement(_reactRouterDom.Link, {
    to: "/purchase/service-confirmation",
    className: "px-3 py-1 rounded bg-white text-brand hover:bg-slate-100"
  }, "\u2190 Back"), /*#__PURE__*/_react["default"].createElement("h1", {
    className: "text-2xl font-bold dark:text-brand-300"
  }, isNew ? "New Service Confirmation" : "Edit Service Confirmation"), /*#__PURE__*/_react["default"].createElement("p", {
    className: "text-sm mt-1"
  }, "Confirm service receipts")), /*#__PURE__*/_react["default"].createElement("div", {
    className: "text-right"
  }, /*#__PURE__*/_react["default"].createElement("div", {
    className: "text-sm"
  }, now.toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric"
  })), /*#__PURE__*/_react["default"].createElement("div", {
    className: "text-sm font-semibold"
  }, now.toLocaleTimeString())))), /*#__PURE__*/_react["default"].createElement("div", {
    className: "card-body"
  }, /*#__PURE__*/_react["default"].createElement("div", {
    className: "grid grid-cols-1 lg:grid-cols-3 gap-6"
  }, /*#__PURE__*/_react["default"].createElement("div", {
    className: "lg:col-span-2 space-y-4"
  }, /*#__PURE__*/_react["default"].createElement("div", {
    className: "card"
  }, /*#__PURE__*/_react["default"].createElement("div", {
    className: "card-body space-y-4"
  }, /*#__PURE__*/_react["default"].createElement("div", {
    className: "text-lg font-semibold"
  }, "Service Order Reference"), /*#__PURE__*/_react["default"].createElement("div", null, /*#__PURE__*/_react["default"].createElement("label", {
    className: "label"
  }, "Completed Service Order *"), /*#__PURE__*/_react["default"].createElement("select", {
    className: "input",
    value: selectedExecutionId,
    onChange: function onChange(e) {
      return setSelectedExecutionId(e.target.value);
    },
    required: true
  }, /*#__PURE__*/_react["default"].createElement("option", {
    value: ""
  }, "Select external service order..."), executions.map(function (ex) {
    return /*#__PURE__*/_react["default"].createElement("option", {
      key: ex.id,
      value: String(ex.id)
    }, ex.order_no || "");
  }))), selectedExecution ? /*#__PURE__*/_react["default"].createElement("div", {
    className: "grid grid-cols-1 md:grid-cols-2 gap-3 bg-blue-50 border border-blue-200 rounded p-3"
  }, /*#__PURE__*/_react["default"].createElement("div", null, /*#__PURE__*/_react["default"].createElement("div", {
    className: "text-xs text-slate-500"
  }, "Order"), /*#__PURE__*/_react["default"].createElement("div", {
    className: "font-semibold"
  }, selectedExecution.order_no || "-")), /*#__PURE__*/_react["default"].createElement("div", null, /*#__PURE__*/_react["default"].createElement("div", {
    className: "text-xs text-slate-500"
  }, "Status"), /*#__PURE__*/_react["default"].createElement("div", {
    className: "font-semibold"
  }, selectedExecution.status || "-")), /*#__PURE__*/_react["default"].createElement("div", null, /*#__PURE__*/_react["default"].createElement("div", {
    className: "text-xs text-slate-500"
  }, "Supervisor"), /*#__PURE__*/_react["default"].createElement("div", {
    className: "font-semibold"
  }, selectedExecution.assigned_supervisor_username || "-")), /*#__PURE__*/_react["default"].createElement("div", null, /*#__PURE__*/_react["default"].createElement("div", {
    className: "text-xs text-slate-500"
  }, "Date"), /*#__PURE__*/_react["default"].createElement("div", {
    className: "font-semibold"
  }, selectedExecution.order_date || "-"))) : null)), /*#__PURE__*/_react["default"].createElement("div", {
    className: "card"
  }, /*#__PURE__*/_react["default"].createElement("div", {
    className: "card-body space-y-4"
  }, /*#__PURE__*/_react["default"].createElement("div", {
    className: "grid grid-cols-1 md:grid-cols-3 gap-4"
  }, /*#__PURE__*/_react["default"].createElement("div", null, /*#__PURE__*/_react["default"].createElement("label", {
    className: "label"
  }, "Date *"), /*#__PURE__*/_react["default"].createElement("input", {
    type: "date",
    className: "input",
    value: formData.sc_date,
    onChange: function onChange(e) {
      return setFormData(_objectSpread(_objectSpread({}, formData), {}, {
        sc_date: e.target.value
      }));
    },
    required: true
  }))), /*#__PURE__*/_react["default"].createElement("div", {
    className: "grid grid-cols-1 md:grid-cols-3 gap-4"
  }, /*#__PURE__*/_react["default"].createElement("div", {
    className: "md:col-span-2"
  }, /*#__PURE__*/_react["default"].createElement("label", {
    className: "label"
  }, "Supplier *"), /*#__PURE__*/_react["default"].createElement("select", {
    className: "input",
    value: formData.supplier_id,
    onChange: function onChange(e) {
      return setFormData(_objectSpread(_objectSpread({}, formData), {}, {
        supplier_id: e.target.value
      }));
    },
    required: true
  }, /*#__PURE__*/_react["default"].createElement("option", {
    value: ""
  }, "Select supplier..."), suppliers.map(function (s) {
    return /*#__PURE__*/_react["default"].createElement("option", {
      key: s.id,
      value: String(s.id)
    }, (s.supplier_code ? "".concat(s.supplier_code, " - ") : "") + s.supplier_name);
  }))), /*#__PURE__*/_react["default"].createElement("div", null, /*#__PURE__*/_react["default"].createElement("label", {
    className: "label"
  }, "Time"), /*#__PURE__*/_react["default"].createElement("input", {
    type: "time",
    className: "input",
    value: appointmentTime,
    onChange: function onChange(e) {
      return setAppointmentTime(e.target.value);
    }
  }))))), /*#__PURE__*/_react["default"].createElement("div", {
    className: "card"
  }, /*#__PURE__*/_react["default"].createElement("div", {
    className: "card-header bg-brand text-white rounded-t-lg"
  }, /*#__PURE__*/_react["default"].createElement("div", {
    className: "flex justify-between items-center"
  }, /*#__PURE__*/_react["default"].createElement("div", {
    className: "font-semibold"
  }, "Service Items to Confirm"), !isView && /*#__PURE__*/_react["default"].createElement("button", {
    type: "button",
    className: "text-sm bg-white/20 hover:bg-white/30 px-2 py-1 rounded",
    onClick: addLine
  }, "+ Add Item"))), /*#__PURE__*/_react["default"].createElement("div", {
    className: "card-body"
  }, !((_formData$details = formData.details) !== null && _formData$details !== void 0 && _formData$details.length) ? /*#__PURE__*/_react["default"].createElement("div", {
    className: "text-center text-slate-500 py-4"
  }, "No service items found.") : /*#__PURE__*/_react["default"].createElement("div", {
    className: "overflow-x-auto"
  }, /*#__PURE__*/_react["default"].createElement("table", {
    className: "w-full text-left border-collapse"
  }, /*#__PURE__*/_react["default"].createElement("thead", null, /*#__PURE__*/_react["default"].createElement("tr", {
    className: "border-b-2 border-slate-200"
  }, /*#__PURE__*/_react["default"].createElement("th", {
    className: "py-2 px-3 font-semibold text-sm"
  }, "Description"), /*#__PURE__*/_react["default"].createElement("th", {
    className: "py-2 px-3 font-semibold text-sm w-24"
  }, "Qty"), /*#__PURE__*/_react["default"].createElement("th", {
    className: "py-2 px-3 font-semibold text-sm w-32"
  }, "Unit Price"), /*#__PURE__*/_react["default"].createElement("th", {
    className: "py-2 px-3 font-semibold text-sm w-32"
  }, "Total"), !isView && /*#__PURE__*/_react["default"].createElement("th", {
    className: "py-2 px-3 w-16"
  }))), /*#__PURE__*/_react["default"].createElement("tbody", null, formData.details.map(function (d, idx) {
    return /*#__PURE__*/_react["default"].createElement("tr", {
      key: idx,
      className: "border-b border-slate-100 last:border-0"
    }, /*#__PURE__*/_react["default"].createElement("td", {
      className: "py-2 px-3"
    }, isView ? /*#__PURE__*/_react["default"].createElement("div", {
      className: "font-medium"
    }, d.description) : /*#__PURE__*/_react["default"].createElement("input", {
      type: "text",
      className: "input w-full",
      placeholder: "Service description",
      value: d.description,
      onChange: function onChange(e) {
        return updateLine(idx, {
          description: e.target.value
        });
      }
    })), /*#__PURE__*/_react["default"].createElement("td", {
      className: "py-2 px-3"
    }, isView ? /*#__PURE__*/_react["default"].createElement("div", null, d.qty) : /*#__PURE__*/_react["default"].createElement("input", {
      type: "number",
      className: "input w-full text-right",
      min: "1",
      value: d.qty,
      onChange: function onChange(e) {
        return updateLine(idx, {
          qty: e.target.value
        });
      }
    })), /*#__PURE__*/_react["default"].createElement("td", {
      className: "py-2 px-3"
    }, isView ? /*#__PURE__*/_react["default"].createElement("div", null, Number(d.unit_price || 0).toFixed(2)) : /*#__PURE__*/_react["default"].createElement("input", {
      type: "number",
      className: "input w-full text-right",
      min: "0",
      step: "0.01",
      value: d.unit_price,
      onChange: function onChange(e) {
        return updateLine(idx, {
          unit_price: e.target.value
        });
      }
    })), /*#__PURE__*/_react["default"].createElement("td", {
      className: "py-2 px-3 font-medium text-right"
    }, (Number(d.qty || 0) * Number(d.unit_price || 0)).toFixed(2)), !isView && /*#__PURE__*/_react["default"].createElement("td", {
      className: "py-2 px-3 text-center"
    }, /*#__PURE__*/_react["default"].createElement("button", {
      type: "button",
      className: "text-red-500 hover:text-red-700 font-bold px-2",
      onClick: function onClick() {
        return removeLine(idx);
      }
    }, "\xD7")));
  })))))), /*#__PURE__*/_react["default"].createElement("div", {
    className: "card"
  }, /*#__PURE__*/_react["default"].createElement("div", {
    className: "card-body space-y-4"
  }, /*#__PURE__*/_react["default"].createElement("div", {
    className: "text-lg font-semibold"
  }, "Service Acceptance"), /*#__PURE__*/_react["default"].createElement("div", {
    className: "space-y-2"
  }, /*#__PURE__*/_react["default"].createElement("label", {
    className: "inline-flex items-center gap-2"
  }, /*#__PURE__*/_react["default"].createElement("input", {
    type: "checkbox",
    checked: accept1,
    onChange: function onChange(e) {
      return setAccept1(e.target.checked);
    }
  }), /*#__PURE__*/_react["default"].createElement("span", null, "All services listed were completed as specified")), /*#__PURE__*/_react["default"].createElement("label", {
    className: "inline-flex items-center gap-2"
  }, /*#__PURE__*/_react["default"].createElement("input", {
    type: "checkbox",
    checked: accept2,
    onChange: function onChange(e) {
      return setAccept2(e.target.checked);
    }
  }), /*#__PURE__*/_react["default"].createElement("span", null, "Work quality meets agreed standards")), /*#__PURE__*/_react["default"].createElement("label", {
    className: "inline-flex items-center gap-2"
  }, /*#__PURE__*/_react["default"].createElement("input", {
    type: "checkbox",
    checked: accept3,
    onChange: function onChange(e) {
      return setAccept3(e.target.checked);
    }
  }), /*#__PURE__*/_react["default"].createElement("span", null, "Materials used were as specified or approved")), /*#__PURE__*/_react["default"].createElement("label", {
    className: "inline-flex items-center gap-2"
  }, /*#__PURE__*/_react["default"].createElement("input", {
    type: "checkbox",
    checked: accept4,
    onChange: function onChange(e) {
      return setAccept4(e.target.checked);
    }
  }), /*#__PURE__*/_react["default"].createElement("span", null, "Service location was left clean and tidy")), /*#__PURE__*/_react["default"].createElement("label", {
    className: "inline-flex items-center gap-2"
  }, /*#__PURE__*/_react["default"].createElement("input", {
    type: "checkbox",
    checked: accept5,
    onChange: function onChange(e) {
      return setAccept5(e.target.checked);
    }
  }), /*#__PURE__*/_react["default"].createElement("span", null, "All documentation, warranties, and instructions received"))), /*#__PURE__*/_react["default"].createElement("div", null, /*#__PURE__*/_react["default"].createElement("label", {
    className: "label"
  }, "Overall Satisfaction *"), /*#__PURE__*/_react["default"].createElement("div", {
    className: "flex flex-wrap gap-3 mt-1"
  }, [5, 4, 3, 2, 1].map(function (n) {
    return /*#__PURE__*/_react["default"].createElement("label", {
      key: n,
      className: "inline-flex items-center gap-2 text-sm"
    }, /*#__PURE__*/_react["default"].createElement("input", {
      type: "radio",
      name: "satisfaction",
      value: String(n),
      checked: satisfaction === String(n),
      onChange: function onChange(e) {
        return setSatisfaction(e.target.value);
      }
    }), Array.from({
      length: n
    }).map(function () {
      return "⭐";
    }).join(""));
  }))), /*#__PURE__*/_react["default"].createElement("div", null, /*#__PURE__*/_react["default"].createElement("label", {
    className: "label"
  }, "Customer Feedback", " ", /*#__PURE__*/_react["default"].createElement("span", {
    className: "text-slate-500"
  }, "(Optional)")), /*#__PURE__*/_react["default"].createElement("textarea", {
    className: "input",
    value: customerFeedback,
    onChange: function onChange(e) {
      return setCustomerFeedback(e.target.value);
    }
  })))), /*#__PURE__*/_react["default"].createElement("div", {
    className: "card"
  }, /*#__PURE__*/_react["default"].createElement("div", {
    className: "card-body space-y-3"
  }, /*#__PURE__*/_react["default"].createElement("div", {
    className: "text-lg font-semibold"
  }, "Additional Information"), /*#__PURE__*/_react["default"].createElement("div", null, /*#__PURE__*/_react["default"].createElement("label", {
    className: "label"
  }, "Remarks"), /*#__PURE__*/_react["default"].createElement("textarea", {
    className: "input",
    rows: "3",
    value: formData.remarks,
    onChange: function onChange(e) {
      return setFormData(_objectSpread(_objectSpread({}, formData), {}, {
        remarks: e.target.value
      }));
    }
  })), /*#__PURE__*/_react["default"].createElement("div", {
    className: "grid grid-cols-1 md:grid-cols-2 gap-4"
  }, /*#__PURE__*/_react["default"].createElement("label", {
    className: "inline-flex items-center gap-2"
  }, /*#__PURE__*/_react["default"].createElement("input", {
    type: "checkbox",
    checked: warrantyProvided,
    onChange: function onChange(e) {
      return setWarrantyProvided(e.target.checked);
    }
  }), /*#__PURE__*/_react["default"].createElement("span", null, "Warranty documentation provided")), /*#__PURE__*/_react["default"].createElement("label", {
    className: "inline-flex items-center gap-2"
  }, /*#__PURE__*/_react["default"].createElement("input", {
    type: "checkbox",
    checked: followUpRequired,
    onChange: function onChange(e) {
      return setFollowUpRequired(e.target.checked);
    }
  }), /*#__PURE__*/_react["default"].createElement("span", null, "Follow-up visit required"))), followUpRequired ? /*#__PURE__*/_react["default"].createElement("div", null, /*#__PURE__*/_react["default"].createElement("label", {
    className: "label"
  }, "Follow-up Details"), /*#__PURE__*/_react["default"].createElement("textarea", {
    className: "input",
    value: followUpNotes,
    onChange: function onChange(e) {
      return setFollowUpNotes(e.target.value);
    }
  })) : null, /*#__PURE__*/_react["default"].createElement("div", null, /*#__PURE__*/_react["default"].createElement("label", {
    className: "label"
  }, "Additional Notes", " ", /*#__PURE__*/_react["default"].createElement("span", {
    className: "text-slate-500"
  }, "(Optional)")), /*#__PURE__*/_react["default"].createElement("textarea", {
    className: "input",
    value: additionalNotes,
    onChange: function onChange(e) {
      return setAdditionalNotes(e.target.value);
    }
  }))))), /*#__PURE__*/_react["default"].createElement("div", {
    className: "space-y-4"
  }, /*#__PURE__*/_react["default"].createElement("div", {
    className: "card"
  }, /*#__PURE__*/_react["default"].createElement("div", {
    className: "card-header bg-brand text-white rounded-t-lg"
  }, /*#__PURE__*/_react["default"].createElement("div", {
    className: "font-semibold"
  }, "Confirmation Summary")), /*#__PURE__*/_react["default"].createElement("div", {
    className: "card-body space-y-2"
  }, /*#__PURE__*/_react["default"].createElement("div", {
    className: "flex justify-between py-1 border-b border-slate-200"
  }, /*#__PURE__*/_react["default"].createElement("div", {
    className: "text-sm"
  }, "Supplier"), /*#__PURE__*/_react["default"].createElement("div", {
    className: "text-sm font-semibold"
  }, supplierName || "-")), /*#__PURE__*/_react["default"].createElement("div", {
    className: "flex justify-between py-1 border-b border-slate-200"
  }, /*#__PURE__*/_react["default"].createElement("div", {
    className: "text-sm"
  }, "Appointment"), /*#__PURE__*/_react["default"].createElement("div", {
    className: "text-sm font-semibold"
  }, (formData.sc_date || "") + (appointmentTime ? " ".concat(appointmentTime) : ""))), /*#__PURE__*/_react["default"].createElement("div", {
    className: "flex justify-between py-1"
  }, /*#__PURE__*/_react["default"].createElement("div", {
    className: "text-sm"
  }, "Location"), /*#__PURE__*/_react["default"].createElement("div", {
    className: "text-sm font-semibold"
  }, "In Shop")), /*#__PURE__*/_react["default"].createElement("div", {
    className: "flex justify-between py-1 border-t pt-2"
  }, /*#__PURE__*/_react["default"].createElement("div", {
    className: "text-sm"
  }, "Total"), /*#__PURE__*/_react["default"].createElement("div", {
    className: "text-sm font-semibold"
  }, "GH\u20B5 ".concat(computedTotal.toFixed(2)))), /*#__PURE__*/_react["default"].createElement("div", {
    className: "mt-2"
  }, /*#__PURE__*/_react["default"].createElement("span", {
    className: "inline-block px-3 py-1 rounded-full text-xs font-semibold " + (readyToConfirm ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700")
  }, readyToConfirm ? "Ready to Confirm" : "Pending Confirmation")))))), /*#__PURE__*/_react["default"].createElement("div", {
    className: "flex justify-end gap-2"
  }, /*#__PURE__*/_react["default"].createElement(_reactRouterDom.Link, {
    to: "/service-management/service-confirmation",
    className: "btn-secondary px-4 py-2"
  }, "Back"), formData.status !== 'APPROVED' && /*#__PURE__*/_react["default"].createElement("button", {
    type: "button",
    className: "btn-success px-4 py-2",
    onClick: handleSubmit,
    disabled: saving || !readyToConfirm
  }, saving ? "Confirming..." : "Confirm")), error ? /*#__PURE__*/_react["default"].createElement("div", {
    className: "text-sm text-red-600 mt-3"
  }, error) : null)), showRejectModal ? /*#__PURE__*/_react["default"].createElement("div", {
    className: "fixed inset-0 bg-black/40 flex items-center justify-center z-50"
  }, /*#__PURE__*/_react["default"].createElement("div", {
    className: "card w-full max-w-lg"
  }, /*#__PURE__*/_react["default"].createElement("div", {
    className: "card-header bg-brand text-white rounded-t-lg"
  }, /*#__PURE__*/_react["default"].createElement("div", {
    className: "font-semibold"
  }, "Service Rejection")), /*#__PURE__*/_react["default"].createElement("div", {
    className: "card-body space-y-3"
  }, /*#__PURE__*/_react["default"].createElement("div", null, /*#__PURE__*/_react["default"].createElement("label", {
    className: "label"
  }, "Reason for Rejection *"), /*#__PURE__*/_react["default"].createElement("textarea", {
    className: "input",
    rows: "4",
    value: rejectionReason,
    onChange: function onChange(e) {
      return setRejectionReason(e.target.value);
    }
  })), /*#__PURE__*/_react["default"].createElement("div", {
    className: "flex justify-end gap-2"
  }, /*#__PURE__*/_react["default"].createElement("button", {
    type: "button",
    className: "btn-secondary",
    onClick: function onClick() {
      return setShowRejectModal(false);
    }
  }, "Cancel"), /*#__PURE__*/_react["default"].createElement("button", {
    type: "button",
    className: "btn-danger",
    onClick: function onClick() {
      if (!rejectionReason.trim()) {
        alert("Please provide a reason for rejection.");
        return;
      }
      alert("Service rejection has been recorded.");
      setShowRejectModal(false);
    }
  }, "Submit Rejection"))))) : null);
}