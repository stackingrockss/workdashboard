"use client";

import { useState, useEffect } from "react";
import { Opportunity } from "@/types/opportunity";
import * as opportunitiesApi from "@/lib/api/opportunities";

export interface UseOpportunitiesResult {
  opportunities: Opportunity[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useOpportunities(): UseOpportunitiesResult {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOpportunities = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await opportunitiesApi.getOpportunities();
      setOpportunities(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOpportunities();
  }, []);

  return {
    opportunities,
    loading,
    error,
    refetch: fetchOpportunities,
  };
}

export interface UseOpportunityResult {
  opportunity: Opportunity | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useOpportunity(id: string): UseOpportunityResult {
  const [opportunity, setOpportunity] = useState<Opportunity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOpportunity = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await opportunitiesApi.getOpportunity(id);
      setOpportunity(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchOpportunity();
    }
  }, [id]);

  return {
    opportunity,
    loading,
    error,
    refetch: fetchOpportunity,
  };
}
