use dep::std;

fn main(
    secret: Field,
    index: Field,
    oldAmount: Field,
    merkle_proof: [[u8; 32]; 3],
    merkle_root: pub Field,
    nullifier: pub Field,
    amount: pub Field,
    deposit: pub bool
) -> pub Field {
    // Implement this
    let hash_secretNullifer = std::hash::poseidon::bn254::hash_1([secret + 1]);

    let hash_secret = std::hash::poseidon::bn254::hash_1([secret]);

    let mut merkleHash:[u8; 32] = [0;32];

    let t = hash_secret.to_be_bytes(32);
    for j in 0 .. merkleHash.len() {
        merkleHash[j] = t[j];
    }

    let i = index as u32;
    let mut inverse = i % 2 != 0;
    merkleHash = hashpair(merkleHash,merkle_proof[0],inverse);
    inverse = (i == 2) | (i== 3) | (i== 6) | (i==7);
    merkleHash = hashpair(merkleHash,merkle_proof[1],inverse);
    inverse = i > 3;
    merkleHash = hashpair(merkleHash,merkle_proof[2],inverse);

    let root = merkle_root.to_be_bytes(32);
    let mut hashRoot:[u8; 32] = [0;32];
    for j in 0 .. 32 {
        hashRoot[j] = root[j];
    }

    assert(nullifier == hash_secretNullifer);
    assert(merkleHash == hashRoot);
}

fn checkWithdraw(
    secret: Field,
    index: Field,
    oldAmount:Field,
    merkle_proof: [[u8; 32]; 3],
    merkle_root:  Field,
    nullifier:  Field,
    amount: Field
) -> pub Field {
    // Implement this
    let hash_secretNullifer = std::hash::poseidon::bn254::hash_1([secret + oldAmount]);

    assert(amount<=oldAmount);

    let hash_secret = std::hash::poseidon::bn254::hash_1([secret]);

    let mut merkleHash:[u8; 32] = [0;32];

    let t = hash_secret.to_be_bytes(32);
    for j in 0 .. merkleHash.len() {
        merkleHash[j] = t[j];
    }

    let i = index as u32;
    let mut inverse = i % 2 != 0;
    merkleHash = hashpair(merkleHash,merkle_proof[0],inverse);
    inverse = (i == 2) | (i== 3) | (i== 6) | (i==7);
    merkleHash = hashpair(merkleHash,merkle_proof[1],inverse);
    inverse = i > 3;
    merkleHash = hashpair(merkleHash,merkle_proof[2],inverse);

    let root = merkle_root.to_be_bytes(32);
    let mut hashRoot:[u8; 32] = [0;32];
    for j in 0 .. 32 {
        hashRoot[j] = root[j];
    }

    assert(nullifier == hash_secretNullifer);
    assert(merkleHash == hashRoot);
}

fn hashpair(
   merkleA: [u8; 32],
   merkleB: [u8; 32],
   inverse: bool
) -> [u8; 32] {
    let mut proofHash :[u8; 64] = [0 ;64];

    if(inverse){
        for i in 0..merkleA.len() {
            // use like this to prevent nargo crash
            proofHash[i+32] = merkleA[i];
            proofHash[i] = merkleB[i];
        }
    }
    else{
        for i in 0..merkleA.len() {
            proofHash[i] = merkleA[i];
            proofHash[i+32] = merkleB[i];
        }
    }

    std::hash::keccak256(proofHash,64) 
}