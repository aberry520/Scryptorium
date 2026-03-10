export type LibraryBook = {
  library_id: string; // uuid
  user_id: string;
  username: string;
  notes: string | null;
  library_created_at: string;
  book_id: string; // uuid
  title: string;
  author: string; // combined from books_with_authors view
  book_created_at: string;
};

export type ActiveLoan = {
  loan_id: string; // uuid
  borrower_user_id: string;
  borrower_name: string | null;
  checkout_date: string;
  due_date: string | null;
};

export type BorrowedLoan = {
  loan_id: string; // uuid
  lender_library_id: string; // uuid
  lender_user_id: string;
  lender_name: string | null;
  checkout_date: string;
  due_date: string | null;
};

export type QRPayload = {
  type: "bookshelf_user";
  userId: string;
  name: string;
};

export type LoanStep =
  | "idle"
  | "scanning"
  | "confirming"
  | "loaning"
  | "done"
  | "return-scanning"
  | "return-confirming"
  | "returning"
  | "return-done";

export type Mode = "search" | "confirm-existing" | "create-new";

export type Book = {
  id: string; // uuid
  title: string;
  subtitle: string | null;
  author: string; // combined string from books_with_authors view
  isbn_10: string | null;
  isbn_13: string | null;
  published_at: string | null;
  cover_url: string | null;
  external_source: string | null;
  external_id: string | null;
  created_at: string;
};
