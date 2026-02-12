import express from "express";
import sanitizeHtml from "sanitize-html";
import { requireAuth, requireCompanyScope } from "../middleware/auth.js";
import { requirePermission } from "../middleware/requirePermission.js";
import { query } from "../db/pool.js";
import { httpError } from "../utils/httpError.js";
import { ensureTemplateTables, toNumber } from "../utils/dbUtils.js";

const router = express.Router();

router.get(
  "/:documentType",
  requireAuth,
  requireCompanyScope,
  async (req, res, next) => {
    try {
      await ensureTemplateTables();
      const { companyId } = req.scope;
      const document_type = String(req.params.documentType || "").trim();
      if (!document_type)
        throw httpError(400, "VALIDATION_ERROR", "Invalid type");
      const items = await query(
        `SELECT id, name, document_type, is_default, created_at, updated_at 
         FROM document_templates 
         WHERE company_id = :companyId AND document_type = :document_type 
         ORDER BY is_default DESC, updated_at DESC`,
        { companyId, document_type },
      ).catch(() => []);
      res.json({ items: Array.isArray(items) ? items : [] });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/item/:id",
  requireAuth,
  requireCompanyScope,
  async (req, res, next) => {
    try {
      await ensureTemplateTables();
      const { companyId } = req.scope;
      const id = toNumber(req.params.id);
      if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");
      const [item] = await query(
        `SELECT id, name, document_type, html_content, is_default, created_at, updated_at,
                header_logo_url, header_name, header_address, header_phone, header_email, header_website
         FROM document_templates 
         WHERE id = :id AND company_id = :companyId 
         LIMIT 1`,
        { id, companyId },
      ).catch(() => []);
      if (!item) throw httpError(404, "NOT_FOUND", "Template not found");
      res.json({ item });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  "/",
  requireAuth,
  requireCompanyScope,
  requirePermission("ADMIN.TEMPLATES.MANAGE"),
  async (req, res, next) => {
    try {
      await ensureTemplateTables();
      const { companyId } = req.scope;
      const {
        name,
        document_type,
        html_content,
        is_default,
        header_logo_url,
        header_name,
        header_address,
        header_phone,
        header_email,
        header_website,
      } = req.body || {};
      const n = String(name || "").trim();
      const dt = String(document_type || "").trim();
      const rawHtml = String(html_content || "");
      if (!n || !dt || !rawHtml)
        throw httpError(400, "VALIDATION_ERROR", "Missing fields");
      const sanitized = sanitizeHtml(rawHtml, {
        allowedTags: [
          "div",
          "span",
          "p",
          "img",
          "style",
          "table",
          "thead",
          "tbody",
          "tr",
          "th",
          "td",
          "h1",
          "h2",
          "h3",
          "h4",
          "h5",
          "h6",
          "ul",
          "ol",
          "li",
          "strong",
          "em",
          "u",
          "br",
          "hr",
        ],
        allowedAttributes: {
          div: ["style", "class"],
          span: ["style", "class"],
          p: ["style", "class"],
          img: ["src", "alt", "style", "class"],
          table: ["style", "class"],
          thead: ["style", "class"],
          tbody: ["style", "class"],
          tr: ["style", "class"],
          th: ["style", "class", "colspan", "rowspan"],
          td: ["style", "class", "colspan", "rowspan"],
          h1: ["style", "class"],
          h2: ["style", "class"],
          h3: ["style", "class"],
          h4: ["style", "class"],
          h5: ["style", "class"],
          h6: ["style", "class"],
          ul: ["style", "class"],
          ol: ["style", "class"],
          li: ["style", "class"],
        },
        allowedStyles: {
          "*": {
            color: [/^.*$/],
            "background-color": [/^.*$/],
            "text-align": [/^.*$/],
            "font-size": [/^.*$/],
            "font-weight": [/^.*$/],
            border: [/^.*$/],
            "border-collapse": [/^.*$/],
            padding: [/^.*$/],
            margin: [/^.*$/],
            width: [/^.*$/],
            height: [/^.*$/],
          },
        },
      });
      const result = await query(
        `INSERT INTO document_templates 
           (company_id, name, document_type, html_content, is_default, created_by,
            header_logo_url, header_name, header_address, header_phone, header_email, header_website) 
         VALUES 
           (:companyId, :n, :dt, :sanitized, :is_default, :userId,
            :header_logo_url, :header_name, :header_address, :header_phone, :header_email, :header_website)`,
        {
          companyId,
          n,
          dt,
          sanitized,
          is_default: Number(Boolean(is_default)),
          userId: req.user?.id || null,
          header_logo_url: header_logo_url ? String(header_logo_url) : null,
          header_name: header_name ? String(header_name) : null,
          header_address: header_address ? String(header_address) : null,
          header_phone: header_phone ? String(header_phone) : null,
          header_email: header_email ? String(header_email) : null,
          header_website: header_website ? String(header_website) : null,
        },
      );
      if (Number(Boolean(is_default))) {
        await query(
          `UPDATE document_templates 
             SET is_default = 0 
           WHERE company_id = :companyId AND document_type = :dt AND id <> :id`,
          { companyId, dt, id: result.insertId },
        );
      }
      res.status(201).json({ id: result.insertId });
    } catch (err) {
      next(err);
    }
  },
);

router.put(
  "/:id",
  requireAuth,
  requireCompanyScope,
  requirePermission("ADMIN.TEMPLATES.MANAGE"),
  async (req, res, next) => {
    try {
      await ensureTemplateTables();
      const { companyId } = req.scope;
      const id = toNumber(req.params.id);
      if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");
      const {
        name,
        html_content,
        is_default,
        header_logo_url,
        header_name,
        header_address,
        header_phone,
        header_email,
        header_website,
      } = req.body || {};
      const n = String(name || "").trim();
      const rawHtml = typeof html_content === "string" ? html_content : null;
      const [existing] = await query(
        `SELECT name, html_content, document_type,
                header_logo_url, header_name, header_address, header_phone, header_email, header_website
           FROM document_templates 
          WHERE id = :id AND company_id = :companyId 
          LIMIT 1`,
        { id, companyId },
      );
      if (!existing) throw httpError(404, "NOT_FOUND", "Template not found");
      const dt = existing.document_type;
      const newName = n || existing.name;
      const sanitized =
        rawHtml != null
          ? sanitizeHtml(String(rawHtml), {
              allowedTags: false,
              allowedAttributes: false,
            })
          : existing.html_content;
      await query(
        `UPDATE document_templates 
           SET name = :newName, html_content = :sanitized, is_default = :is_default,
               header_logo_url = :header_logo_url,
               header_name = :header_name,
               header_address = :header_address,
               header_phone = :header_phone,
               header_email = :header_email,
               header_website = :header_website
         WHERE id = :id AND company_id = :companyId`,
        {
          id,
          companyId,
          newName,
          sanitized,
          is_default: Number(Boolean(is_default)),
          header_logo_url:
            header_logo_url !== undefined
              ? String(header_logo_url || "")
              : existing.header_logo_url || null,
          header_name:
            header_name !== undefined
              ? String(header_name || "")
              : existing.header_name || null,
          header_address:
            header_address !== undefined
              ? String(header_address || "")
              : existing.header_address || null,
          header_phone:
            header_phone !== undefined
              ? String(header_phone || "")
              : existing.header_phone || null,
          header_email:
            header_email !== undefined
              ? String(header_email || "")
              : existing.header_email || null,
          header_website:
            header_website !== undefined
              ? String(header_website || "")
              : existing.header_website || null,
        },
      );
      if (Number(Boolean(is_default))) {
        await query(
          `UPDATE document_templates 
             SET is_default = 0 
           WHERE company_id = :companyId AND document_type = :dt AND id <> :id`,
          { companyId, dt, id },
        );
      }
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  },
);

router.delete(
  "/:id",
  requireAuth,
  requireCompanyScope,
  requirePermission("ADMIN.TEMPLATES.MANAGE"),
  async (req, res, next) => {
    try {
      await ensureTemplateTables();
      const { companyId } = req.scope;
      const id = toNumber(req.params.id);
      if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");
      const [existing] = await query(
        `SELECT is_default FROM document_templates WHERE id = :id AND company_id = :companyId LIMIT 1`,
        { id, companyId },
      );
      if (!existing) throw httpError(404, "NOT_FOUND", "Template not found");
      if (Number(existing.is_default) === 1)
        throw httpError(
          400,
          "VALIDATION_ERROR",
          "Default template cannot be deleted",
        );
      await query(
        `DELETE FROM document_templates WHERE id = :id AND company_id = :companyId`,
        { id, companyId },
      );
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
