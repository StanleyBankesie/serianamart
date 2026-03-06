import { apiClient } from "../../services/apiClient.js";

const baseUrl = "/sales/customers";

export const customerAPI = {
  async list(params = {}) {
    const res = await apiClient.get(baseUrl, { params });
    const items = Array.isArray(res?.items)
      ? res.items
      : Array.isArray(res)
        ? res
        : [];
    return items;
  },
  async create(payload) {
    const res = await apiClient.post(baseUrl, payload);
    const item = res?.item || res;
    return item;
  },
  async update(id, payload) {
    const res = await apiClient.put(`${baseUrl}/${id}`, payload);
    const item = res?.item || res;
    return item;
  },
  async remove(id) {
    const res = await apiClient.delete(`${baseUrl}/${id}`);
    return res?.success === true ? { id } : { id };
  },
};

export default customerAPI;
