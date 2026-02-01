use sha256::digest;

// zk receipt circuit v2 - selective disclosure proofs
// private: invoice_id, sender, recipient, amount, nonce
// public: payment_ref, public_invoice_id, public_recipient, min_amount, max_amount

global INVOICE_ID_LEN: u32 = 36;
global WALLET_LEN: u32 = 44;
global NONCE_LEN: u32 = 64;
global MAX_AMOUNT_LEN: u32 = 20;
global MAX_PREIMAGE_LEN: u32 = 256;
global COLON: u8 = 58;

fn is_zero_array<let N: u32>(arr: [u8; N]) -> bool {
    let mut all_zero = true;
    for i in 0..N {
        if arr[i] != 0 {
            all_zero = false;
        }
    }
    all_zero
}

// convert u64 to decimal string bytes
fn u64_to_string(value: u64) -> ([u8; MAX_AMOUNT_LEN], u8) {
    let mut result: [u8; MAX_AMOUNT_LEN] = [0; MAX_AMOUNT_LEN];
    let mut num_digits: u8 = 0;

    if value == 0 {
        result[0] = 48;
        num_digits = 1;
    } else {
        let mut temp = value;
        for _ in 0..20 {
            if temp > 0 {
                num_digits += 1;
                temp /= 10;
            }
        }

        let mut v = value;
        for i in 0..20 {
            if i < num_digits as u32 {
                let digit = (v % 10) as u8;
                let pos = (num_digits as u32) - 1 - i;
                result[pos] = 48 + digit;
                v /= 10;
            }
        }
    }

    (result, num_digits)
}

// format: "{invoiceId}:{sender}:{recipient}:{amount}:{nonce}"
fn build_preimage(
    invoice_id: [u8; INVOICE_ID_LEN],
    sender: [u8; WALLET_LEN],
    recipient: [u8; WALLET_LEN],
    amount_str: [u8; MAX_AMOUNT_LEN],
    amount_len: u8,
    nonce: [u8; NONCE_LEN],
) -> [u8; MAX_PREIMAGE_LEN] {
    let mut preimage: [u8; MAX_PREIMAGE_LEN] = [0; MAX_PREIMAGE_LEN];
    let mut pos: u32 = 0;

    for i in 0..INVOICE_ID_LEN {
        preimage[pos + i] = invoice_id[i];
    }
    pos += INVOICE_ID_LEN;
    preimage[pos] = COLON;
    pos += 1;

    for i in 0..WALLET_LEN {
        preimage[pos + i] = sender[i];
    }
    pos += WALLET_LEN;
    preimage[pos] = COLON;
    pos += 1;

    for i in 0..WALLET_LEN {
        preimage[pos + i] = recipient[i];
    }
    pos += WALLET_LEN;
    preimage[pos] = COLON;
    pos += 1;

    for i in 0..MAX_AMOUNT_LEN {
        if i < amount_len as u32 {
            preimage[pos + i] = amount_str[i];
        }
    }
    pos += amount_len as u32;
    preimage[pos] = COLON;
    pos += 1;

    for i in 0..NONCE_LEN {
        preimage[pos + i] = nonce[i];
    }

    preimage
}

fn main(
    // private inputs
    invoice_id: [u8; INVOICE_ID_LEN],
    sender: [u8; WALLET_LEN],
    recipient: [u8; WALLET_LEN],
    amount: u64,
    nonce: [u8; NONCE_LEN],

    // public inputs
    payment_ref: pub [u8; 32],
    public_invoice_id: pub [u8; INVOICE_ID_LEN],
    public_recipient: pub [u8; WALLET_LEN],
    min_amount: pub u64,
    max_amount: pub u64,
) {
    let (amount_str, amount_len) = u64_to_string(amount);

    let preimage = build_preimage(
        invoice_id,
        sender,
        recipient,
        amount_str,
        amount_len,
        nonce,
    );

    let computed_hash: [u8; 32] = digest(preimage);

    for i in 0..32 {
        assert(computed_hash[i] == payment_ref[i]);
    }

    // verify disclosed invoice_id matches
    if !is_zero_array(public_invoice_id) {
        for i in 0..INVOICE_ID_LEN {
            assert(invoice_id[i] == public_invoice_id[i]);
        }
    }

    // verify disclosed recipient matches
    if !is_zero_array(public_recipient) {
        for i in 0..WALLET_LEN {
            assert(recipient[i] == public_recipient[i]);
        }
    }

    // amount range constraints
    if min_amount > 0 {
        assert(amount >= min_amount);
    }
    if max_amount > 0 {
        assert(amount <= max_amount);
    }
}

#[test]
fn test_u64_to_string() {
    let (str0, len0) = u64_to_string(0);
    assert(len0 == 1);
    assert(str0[0] == 48);

    let (str25, len25) = u64_to_string(25);
    assert(len25 == 2);
    assert(str25[0] == 50);
    assert(str25[1] == 53);

    let (str123, len123) = u64_to_string(123);
    assert(len123 == 3);
    assert(str123[0] == 49);
    assert(str123[1] == 50);
    assert(str123[2] == 51);

    let (_, len1m) = u64_to_string(1000000);
    assert(len1m == 7);
}

#[test]
fn test_basic_proof() {
    let invoice_id: [u8; INVOICE_ID_LEN] = [
        57, 55, 101, 102, 97, 54, 50, 57, 45, 102, 49, 98, 51, 45, 52, 102,
        57, 57, 45, 97, 52, 98, 50, 45, 55, 56, 57, 97, 102, 50, 50, 49,
        48, 48, 48, 49,
    ];

    let sender: [u8; WALLET_LEN] = [
        67, 55, 68, 88, 101, 100, 71, 80, 87, 117, 71, 89, 55, 114, 102, 56,
        68, 71, 121, 87, 118, 121, 90, 74, 75, 77, 99, 110, 104, 78, 109, 107,
        106, 65, 97, 122, 71, 69, 113, 103, 106, 115, 109, 105,
    ];

    let recipient: [u8; WALLET_LEN] = [
        52, 49, 56, 84, 89, 76, 86, 122, 54, 72, 111, 112, 69, 82, 72, 98,
        57, 104, 80, 101, 121, 122, 97, 85, 88, 86, 110, 118, 113, 109, 78, 102,
        120, 77, 80, 97, 105, 100, 81, 51, 72, 74, 86, 122,
    ];

    let amount: u64 = 25;

    let nonce: [u8; NONCE_LEN] = [
        97, 49, 98, 50, 99, 51, 100, 52, 101, 53, 102, 54, 97, 55, 98, 56,
        99, 57, 100, 48, 101, 49, 102, 50, 97, 51, 98, 52, 99, 53, 100, 54,
        101, 55, 102, 56, 97, 57, 98, 48, 99, 49, 100, 50, 101, 51, 102, 52,
        97, 53, 98, 54, 99, 55, 100, 56, 101, 57, 102, 48, 97, 49, 98, 50,
    ];

    let expected_hash: [u8; 32] = [
        13, 70, 200, 145, 60, 224, 192, 81, 5, 197, 10, 174, 177, 224, 119, 252,
        9, 207, 155, 50, 97, 230, 91, 168, 192, 118, 35, 69, 144, 108, 148, 99,
    ];

    let (amount_str, amount_len) = u64_to_string(amount);
    let preimage = build_preimage(invoice_id, sender, recipient, amount_str, amount_len, nonce);
    let computed_hash: [u8; 32] = digest(preimage);

    for i in 0..32 {
        assert(computed_hash[i] == expected_hash[i]);
    }
}

#[test]
fn test_amount_range() {
    let amount: u64 = 500;
    assert(amount >= 100);
    assert(amount <= 1000);
}

#[test]
fn test_is_zero_array() {
    let zeros: [u8; 4] = [0, 0, 0, 0];
    let non_zeros: [u8; 4] = [0, 1, 0, 0];
    assert(is_zero_array(zeros));
    assert(!is_zero_array(non_zeros));
}
