use sha256::digest;

// invoice payment proof v1
//
// proves: "I know a preimage that hashes to payment_ref"
// this is the foundation for invoice payment proofs
//
// the TypeScript side computes:
// preimage = "${invoiceId}:${sender}:${recipient}:${amount}:${nonce}"
// payment_ref = SHA256(preimage)

// maximum preimage length we support (256 bytes should be plenty)
global MAX_PREIMAGE_LEN: u32 = 256;

// Field lengths for invoice preimage components
global INVOICE_ID_LEN: u32 = 36; // UUID format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
global WALLET_LEN: u32 = 44; // Solana base58 pubkey
global NONCE_LEN: u32 = 64; // SHA256 hex string (32 bytes = 64 hex chars)
global COLON: u8 = 58; // ':' ASCII

// Build preimage from invoice components
// Format: "{invoiceId}:{sender}:{recipient}:{amount}:{nonce}"
fn build_preimage<let AMOUNT_LEN: u32>(
    invoice_id: [u8; INVOICE_ID_LEN],
    sender: [u8; WALLET_LEN],
    recipient: [u8; WALLET_LEN],
    amount: [u8; AMOUNT_LEN],
    nonce: [u8; NONCE_LEN],
) -> [u8; MAX_PREIMAGE_LEN] {
    let mut preimage: [u8; MAX_PREIMAGE_LEN] = [0; MAX_PREIMAGE_LEN];
    let mut pos: u32 = 0;

    // Copy invoice_id
    for i in 0..INVOICE_ID_LEN {
        preimage[pos + i] = invoice_id[i];
    }
    pos += INVOICE_ID_LEN;
    preimage[pos] = COLON;
    pos += 1;

    // Copy sender
    for i in 0..WALLET_LEN {
        preimage[pos + i] = sender[i];
    }
    pos += WALLET_LEN;
    preimage[pos] = COLON;
    pos += 1;

    // Copy recipient
    for i in 0..WALLET_LEN {
        preimage[pos + i] = recipient[i];
    }
    pos += WALLET_LEN;
    preimage[pos] = COLON;
    pos += 1;

    // Copy amount
    for i in 0..AMOUNT_LEN {
        preimage[pos + i] = amount[i];
    }
    pos += AMOUNT_LEN;
    preimage[pos] = COLON;
    pos += 1;

    // Copy nonce
    for i in 0..NONCE_LEN {
        preimage[pos + i] = nonce[i];
    }

    preimage
}

fn main(
    // private inputs
    preimage: [u8; MAX_PREIMAGE_LEN],
    // public inputs
    payment_ref: pub [u8; 32],
) {
    // compute SHA256 of the preimage
    let computed_hash: [u8; 32] = digest(preimage);

    //verify computed hash matches the public payment_ref
    for i in 0..32 {
        assert(computed_hash[i] == payment_ref[i]);
    }
}

#[test]
fn test_real_invoice() {
    // real invoice test data:
    // invoice ID: 97efa629-f1b3-4f99-a4b2-789af2210001
    // sender: C7DXedGPWuGY7rf8DGyWvyZJKMcnhNmkjAazGEqgjsmi
    // recipient: 418TYLVz6HopERHb9hPeyzaUXVnvqmNfxMPaidQ3HJVz
    // amount: 25
    // nonce: a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2
    // preimage: "97efa629-f1b3-4f99-a4b2-789af2210001:C7DXedGPWuGY7rf8DGyWvyZJKMcnhNmkjAazGEqgjsmi:418TYLVz6HopERHb9hPeyzaUXVnvqmNfxMPaidQ3HJVz:25:a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2"
    // rayment Ref: 0d46c8913ce0c05105c50aaeb1e077fc09cf9b3261e65ba8c0762345906c9463

    let preimage: [u8; MAX_PREIMAGE_LEN] = [
        57, 55, 101, 102, 97, 54, 50, 57, 45, 102, 49, 98, 51, 45, 52, 102, 57, 57, 45, 97, 52, 98,
        50, 45, 55, 56, 57, 97, 102, 50, 50, 49, 48, 48, 48, 49, 58, 67, 55, 68, 88, 101, 100, 71,
        80, 87, 117, 71, 89, 55, 114, 102, 56, 68, 71, 121, 87, 118, 121, 90, 74, 75, 77, 99, 110,
        104, 78, 109, 107, 106, 65, 97, 122, 71, 69, 113, 103, 106, 115, 109, 105, 58, 52, 49, 56,
        84, 89, 76, 86, 122, 54, 72, 111, 112, 69, 82, 72, 98, 57, 104, 80, 101, 121, 122, 97, 85,
        88, 86, 110, 118, 113, 109, 78, 102, 120, 77, 80, 97, 105, 100, 81, 51, 72, 74, 86, 122, 58,
        50, 53, 58, 97, 49, 98, 50, 99, 51, 100, 52, 101, 53, 102, 54, 97, 55, 98, 56, 99, 57, 100,
        48, 101, 49, 102, 50, 97, 51, 98, 52, 99, 53, 100, 54, 101, 55, 102, 56, 97, 57, 98, 48, 99,
        49, 100, 50, 101, 51, 102, 52, 97, 53, 98, 54, 99, 55, 100, 56, 101, 57, 102, 48, 97, 49,
        98, 50, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0,
    ];

    let expected_hash: [u8; 32] = [
        13, 70, 200, 145, 60, 224, 192, 81, 5, 197, 10, 174, 177, 224, 119, 252, 9, 207, 155, 50,
        97, 230, 91, 168, 192, 118, 35, 69, 144, 108, 148, 99,
    ];

    let computed_hash: [u8; 32] = digest(preimage);
    for i in 0..32 {
        assert(computed_hash[i] == expected_hash[i]);
    }
}

#[test]
fn test_build_preimage() {
    // test building preimage from components
    // invoice ID: 97efa629-f1b3-4f99-a4b2-789af2210001
    let invoice_id: [u8; INVOICE_ID_LEN] = [
        57, 55, 101, 102, 97, 54, 50, 57, 45, 102, 49, 98, 51, 45, 52, 102, 57, 57, 45, 97, 52, 98,
        50, 45, 55, 56, 57, 97, 102, 50, 50, 49, 48, 48, 48, 49,
    ]; // "97efa629-f1b3-4f99-a4b2-789af2210001"

    // sender: C7DXedGPWuGY7rf8DGyWvyZJKMcnhNmkjAazGEqgjsmi
    let sender: [u8; WALLET_LEN] = [
        67, 55, 68, 88, 101, 100, 71, 80, 87, 117, 71, 89, 55, 114, 102, 56, 68, 71, 121, 87, 118,
        121, 90, 74, 75, 77, 99, 110, 104, 78, 109, 107, 106, 65, 97, 122, 71, 69, 113, 103, 106,
        115, 109, 105,
    ]; // "C7DXedGPWuGY7rf8DGyWvyZJKMcnhNmkjAazGEqgjsmi"

    // recipient: 418TYLVz6HopERHb9hPeyzaUXVnvqmNfxMPaidQ3HJVz
    let recipient: [u8; WALLET_LEN] = [
        52, 49, 56, 84, 89, 76, 86, 122, 54, 72, 111, 112, 69, 82, 72, 98, 57, 104, 80, 101, 121,
        122, 97, 85, 88, 86, 110, 118, 113, 109, 78, 102, 120, 77, 80, 97, 105, 100, 81, 51, 72, 74,
        86, 122,
    ]; // "418TYLVz6HopERHb9hPeyzaUXVnvqmNfxMPaidQ3HJVz"

    // amount: 25
    let amount: [u8; 2] = [50, 53]; // "25"

    // nonce: a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2
    let nonce: [u8; NONCE_LEN] = [
        97, 49, 98, 50, 99, 51, 100, 52, 101, 53, 102, 54, 97, 55, 98, 56, 99, 57, 100, 48, 101, 49,
        102, 50, 97, 51, 98, 52, 99, 53, 100, 54, 101, 55, 102, 56, 97, 57, 98, 48, 99, 49, 100, 50,
        101, 51, 102, 52, 97, 53, 98, 54, 99, 55, 100, 56, 101, 57, 102, 48, 97, 49, 98, 50,
    ]; // "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2"

    // build the preimage
    let preimage = build_preimage(invoice_id, sender, recipient, amount, nonce);

    // expected preimage (same as test_real_invoice)
    let expected_preimage: [u8; MAX_PREIMAGE_LEN] = [
        57, 55, 101, 102, 97, 54, 50, 57, 45, 102, 49, 98, 51, 45, 52, 102, 57, 57, 45, 97, 52, 98,
        50, 45, 55, 56, 57, 97, 102, 50, 50, 49, 48, 48, 48, 49, 58, 67, 55, 68, 88, 101, 100, 71,
        80, 87, 117, 71, 89, 55, 114, 102, 56, 68, 71, 121, 87, 118, 121, 90, 74, 75, 77, 99, 110,
        104, 78, 109, 107, 106, 65, 97, 122, 71, 69, 113, 103, 106, 115, 109, 105, 58, 52, 49, 56,
        84, 89, 76, 86, 122, 54, 72, 111, 112, 69, 82, 72, 98, 57, 104, 80, 101, 121, 122, 97, 85,
        88, 86, 110, 118, 113, 109, 78, 102, 120, 77, 80, 97, 105, 100, 81, 51, 72, 74, 86, 122, 58,
        50, 53, 58, 97, 49, 98, 50, 99, 51, 100, 52, 101, 53, 102, 54, 97, 55, 98, 56, 99, 57, 100,
        48, 101, 49, 102, 50, 97, 51, 98, 52, 99, 53, 100, 54, 101, 55, 102, 56, 97, 57, 98, 48, 99,
        49, 100, 50, 101, 51, 102, 52, 97, 53, 98, 54, 99, 55, 100, 56, 101, 57, 102, 48, 97, 49,
        98, 50, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0,
    ];

    // verify preimage matches
    for i in 0..MAX_PREIMAGE_LEN {
        assert(preimage[i] == expected_preimage[i]);
    }

    // also verify hash
    let expected_hash: [u8; 32] = [
        13, 70, 200, 145, 60, 224, 192, 81, 5, 197, 10, 174, 177, 224, 119, 252, 9, 207, 155, 50,
        97, 230, 91, 168, 192, 118, 35, 69, 144, 108, 148, 99,
    ];

    let computed_hash: [u8; 32] = digest(preimage);
    for i in 0..32 {
        assert(computed_hash[i] == expected_hash[i]);
    }
}
