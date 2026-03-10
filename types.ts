export type LibraryBook = {
  library_id: number;
  user_id: string;
  username: string;
  notes: string | null;
  library_created_at: string;
  book_id: number;
  title: string;
  author: string;
  book_created_at: string;
};

// Book the current user has lent to someone else (return_date IS NULL)
export type ActiveLoan = {
  loan_id: number;
  borrower_user_id: string;
  borrower_name: string | null;
  checkout_date: string;
  due_date: string | null;
};

// Book the current user has borrowed from someone else (return_date IS NULL)
export type BorrowedLoan = {
  loan_id: number;
  lender_library_id: number;
  lender_user_id: string;
  lender_name: string | null;
  checkout_date: string;
  due_date: string | null;
};

// QR code payload encoded in each user's profile QR
export type QRPayload = {
  type: "bookshelf_user";
  userId: string;
  name: string;
};

// Steps in the loan / return flow inside BookDetailModal
export type LoanStep =
  | "idle" // book detail view
  | "scanning" // camera open for lending — waiting for borrower QR
  | "confirming" // scanned borrower, show confirm screen
  | "loaning" // supabase calls in progress
  | "done" // loan success
  | "return-scanning" // camera open for returning — waiting for lender QR
  | "return-confirming" // scanned lender, show return confirm
  | "returning" // return supabase calls in progress
  | "return-done"; // return success

export type Mode = "search" | "confirm-existing" | "create-new";

export type Book = {
  id: number;
  title: string;
  author: string;
  created_at: string;
};
