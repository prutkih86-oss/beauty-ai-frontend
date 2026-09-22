import { apiGetAllPages, apiPost } from "./client";

export interface Promotion {
  id: number;
  name: string;
  description: string;
  discount_percent: number;
  start_date: string;
  end_date: string;
  salon: number;
}

export interface CreatePromotionPayload {
  name: string;
  description: string;
  discount_percent: number;
  start_date: string;
  end_date: string;
  salon: number;
}

export async function getPromotions(): Promise<Promotion[]> {
  return apiGetAllPages<Promotion>("/api/promotions/");
}

export async function addPromotion(data: CreatePromotionPayload): Promise<Promotion> {
  return apiPost<Promotion>("/api/promotions/", data);
}