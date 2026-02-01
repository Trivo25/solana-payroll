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
fn test_empty_preimage() {
    let preimage: [u8; MAX_PREIMAGE_LEN] = [0; MAX_PREIMAGE_LEN];
}
