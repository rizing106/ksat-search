export type BBox = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type Difficulty5 =
  | "매우 쉬움"
  | "쉬움"
  | "보통"
  | "어려움(준킬러)"
  | "매우 어려움(킬러)";

export type Killer3 = "비킬러" | "준킬러" | "킬러";

export type Tables = {
  organizations: {
    Row: {
      id: string;
      code2: string;
      name: string;
      kind: "official" | "private";
      created_at: string;
      updated_at: string;
    };
    Insert: {
      id?: string;
      code2: string;
      name: string;
      kind: "official" | "private";
      created_at?: string;
      updated_at?: string;
    };
    Update: {
      id?: string;
      code2?: string;
      name?: string;
      kind?: "official" | "private";
      created_at?: string;
      updated_at?: string;
    };
  };
  subjects: {
    Row: {
      id: string;
      code2: string;
      name: string;
      created_at: string;
      updated_at: string;
    };
    Insert: {
      id?: string;
      code2: string;
      name: string;
      created_at?: string;
      updated_at?: string;
    };
    Update: {
      id?: string;
      code2?: string;
      name?: string;
      created_at?: string;
      updated_at?: string;
    };
  };
  questions: {
    Row: {
      id: string;
      public_qid: string;
      org_code2: string;
      subject_code2: string;
      year: number;
      month: number;
      number: number;
      unit: string;
      qtype: string;
      correct_rate: number | null;
      difficulty_5: Difficulty5 | null;
      killer_3: Killer3 | null;
      pdf_url: string;
      page_no: number;
      bbox: BBox;
      explanation_allowed: boolean;
      created_at: string;
      updated_at: string;
    };
    Insert: {
      id?: string;
      public_qid: string;
      org_code2: string;
      subject_code2: string;
      year: number;
      month: number;
      number: number;
      unit: string;
      qtype: string;
      correct_rate?: number | null;
      pdf_url: string;
      page_no: number;
      bbox: BBox;
      explanation_allowed?: boolean;
      created_at?: string;
      updated_at?: string;
    };
    Update: {
      id?: string;
      public_qid?: string;
      org_code2?: string;
      subject_code2?: string;
      year?: number;
      month?: number;
      number?: number;
      unit?: string;
      qtype?: string;
      correct_rate?: number | null;
      pdf_url?: string;
      page_no?: number;
      bbox?: BBox;
      explanation_allowed?: boolean;
      created_at?: string;
      updated_at?: string;
    };
  };
  question_tokens: {
    Row: {
      question_id: string;
      tokens: string[];
      bigrams: string[];
      trigrams: string[];
      created_at: string;
      updated_at: string;
    };
    Insert: {
      question_id: string;
      tokens?: string[];
      bigrams?: string[];
      trigrams?: string[];
      created_at?: string;
      updated_at?: string;
    };
    Update: {
      question_id?: string;
      tokens?: string[];
      bigrams?: string[];
      trigrams?: string[];
      created_at?: string;
      updated_at?: string;
    };
  };
  profiles: {
    Row: {
      user_id: string;
      role: "admin" | "teacher" | "user";
      created_at: string;
      updated_at: string;
    };
    Insert: {
      user_id: string;
      role?: "admin" | "teacher" | "user";
      created_at?: string;
      updated_at?: string;
    };
    Update: {
      user_id?: string;
      role?: "admin" | "teacher" | "user";
      created_at?: string;
      updated_at?: string;
    };
  };
  issue_reports: {
    Row: {
      id: string;
      question_id: string;
      user_id: string | null;
      message: string;
      status: string;
      created_at: string;
      updated_at: string;
    };
    Insert: {
      id?: string;
      question_id: string;
      user_id?: string | null;
      message: string;
      status?: string;
      created_at?: string;
      updated_at?: string;
    };
    Update: {
      id?: string;
      question_id?: string;
      user_id?: string | null;
      message?: string;
      status?: string;
      created_at?: string;
      updated_at?: string;
    };
  };
  explanation_suggestions: {
    Row: {
      id: string;
      question_id: string;
      user_id: string;
      markdown: string;
      youtube_video_id: string | null;
      start_seconds: number | null;
      status: string;
      created_at: string;
      updated_at: string;
    };
    Insert: {
      id?: string;
      question_id: string;
      user_id: string;
      markdown: string;
      youtube_video_id?: string | null;
      start_seconds?: number | null;
      status?: string;
      created_at?: string;
      updated_at?: string;
    };
    Update: {
      id?: string;
      question_id?: string;
      user_id?: string;
      markdown?: string;
      youtube_video_id?: string | null;
      start_seconds?: number | null;
      status?: string;
      created_at?: string;
      updated_at?: string;
    };
  };
};

export type QuestionSearchFilters = {
  org_code2?: string;
  subject_code2?: string;
  year?: number;
  month?: number;
  number?: number;
  unit?: string;
  qtype?: string;
  difficulty_5?: Difficulty5;
  killer_3?: Killer3;
};

export type SearchQuestionsParams = {
  q?: string;
  filters?: QuestionSearchFilters;
  page?: number;
  pageSize?: number;
};
