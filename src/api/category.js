import axios from "axios";
const API_URL = "https://bebookgift-hugmbshcgaa0b4d6.eastasia-01.azurewebsites.net/api/categories";

export const getCategories = () => axios.get(API_URL);
export const getCategory = (id) => axios.get(`${API_URL}/${id}`);
export const createCategory = (data) => {
    // Nếu data là FormData, gửi trực tiếp, nếu không thì tạo FormData
    if (data instanceof FormData) {
        return axios.post(API_URL, data, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
    }
    return axios.post(API_URL, data);
};
export const updateCategory = (id, data) => {
    // Nếu data là FormData, gửi trực tiếp, nếu không thì tạo FormData
    if (data instanceof FormData) {
        return axios.post(`${API_URL}/${id}?_method=PUT`, data, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
    }
    return axios.put(`${API_URL}/${id}`, data);
};
export const deleteCategory = (id) => axios.delete(`${API_URL}/${id}`);
