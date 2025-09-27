import { useState, useEffect, useCallback } from 'react';
import useSWR from 'swr';

interface SearchQuery {
  query?: string;
  from?: string;
  to?: string;
  chatId?: string;
  page?: number;
  limit?: number;
}

interface Message {
  _id: string;
  msgId: string;
  content: string;
  sender: string;
  receiver: string;
  timestamp: number;
  chatId: string;
  type: number;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

interface SearchResponse {
  success: boolean;
  data: {
    messages: Message[];
    pagination: Pagination;
  };
}

const fetcher = async (url: string) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Failed to fetch');
  }
  return response.json();
};

export function useSearch(query: SearchQuery) {
  const [searchQuery, setSearchQuery] = useState(query);
  
  const queryString = new URLSearchParams(
    Object.entries(searchQuery).reduce((acc, [key, value]) => {
      if (value !== undefined) {
        acc[key] = String(value);
      }
      return acc;
    }, {} as Record<string, string>)
  ).toString();

  const { data, error, isLoading, mutate } = useSWR<SearchResponse>(
    queryString ? `/api/search?${queryString}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    }
  );

  const refetch = useCallback(() => {
    mutate();
  }, [mutate]);

  const messages = data?.data?.messages || [];
  const pagination = data?.data?.pagination;

  return {
    messages,
    pagination,
    isLoading,
    error,
    refetch,
    setSearchQuery
  };
}

export function useChats() {
  const { data, error, isLoading } = useSWR<{
    success: boolean;
    data: Array<{
      chatId: string;
      lastMessage: Message;
      messageCount: number;
      lastTimestamp: number;
    }>;
  }>('/api/chats', fetcher, {
    revalidateOnFocus: false,
  });

  return {
    chats: data?.data || [],
    isLoading,
    error
  };
}