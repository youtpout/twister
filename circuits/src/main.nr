use dep::std;

fn main(
    secret: Field,
    oldAmount: Field,
    // tree with 8 depth for test
    merkle_proof: [([u8; 32],bool); 8],
    leaf: pub Field,
    merkle_root: pub Field,
    nullifier: pub Field,
    amount: pub Field,
    receiver: pub Field,
    relayer: pub Field,
    deposit: pub bool
) -> pub [Field; 2] {
    let mut result:[Field; 2] = [0; 2];
    if deposit {
        // we check on deposit if the user deposit the correct amount of eth
        assert(oldAmount == amount);
        let newLeaf = std::hash::poseidon::bn254::hash_2([secret, amount]);
        let nullifier = std::hash::pedersen_hash([amount, secret]);
        assert(newLeaf == leaf);
        result = [newLeaf,nullifier];
    } else {
        // we need to define relayer and receiver to withdraw, relayer and receiver can be the same account
        assert(receiver != 0);
        assert(relayer != 0);
        result = checkWithdraw(
            secret,
            oldAmount,
            leaf,
            merkle_proof,
            merkle_root,
            nullifier,
            amount
        );
    }

    // for each proof we generate new leaf and nullifier for next withdraw
    result
}

fn checkWithdraw(
    secret: Field,
    oldAmount: Field,
    leaf: Field,
    merkle_proof: [([u8; 32],bool); 8],
    merkle_root: Field,
    nullifier: Field,
    amount: Field
) -> [Field; 2] {
    let hash_secretNullifer = std::hash::pedersen_hash([secret, oldAmount]);
    assert(nullifier == hash_secretNullifer);

    // uint112 type like uniswap pool
    let amountOut = amount as u112;
    let amountOld = oldAmount as u112;
    // we can't withdraw more than actual account amount
    assert(amountOut <= amountOld);

    let newAmount = oldAmount - amount;

    // check if leaf match secret and amount
    let hash_secret = std::hash::poseidon::bn254::hash_2([oldAmount, secret]);
    assert(hash_secret == leaf);

    let mut merkleHash:[u8; 32] = [0; 32];

    let t = hash_secret.to_be_bytes(32);
    for j in 0..merkleHash.len() {
        merkleHash[j] = t[j];
    }

    for index in 0 .. merkle_proof {
        let (mp,inverse) = merkle_proof[index];
         merkleHash = hashpair(merkleHash,mp,inverse);
    }

    let root = merkle_root.to_be_bytes(32);
    let mut hashRoot:[u8; 32] = [0; 32];
    for j in 0..32 {
        hashRoot[j] = root[j];
    }

    assert(merkleHash == hashRoot);

    // generate new leaf and new nullifier for next withdraw
    let newLeaf = std::hash::poseidon::bn254::hash_2([secret, newAmount]);
    let newNullifier = std::hash::pedersen_hash([newAmount, secret]);
    [newLeaf, newNullifier]
}

fn hashpair(merkleA: [u8; 32], merkleB: [u8; 32], inverse: bool) -> [u8; 32] {
    let mut proofHash :[u8; 64] = [0; 64];

    if (inverse) {
        for i in 0..merkleA.len() {
            // use like this to prevent nargo crash
            proofHash[i+32] = merkleA[i];
            proofHash[i] = merkleB[i];
        }
    } else {
        for i in 0..merkleA.len() {
            proofHash[i] = merkleA[i];
            proofHash[i+32] = merkleB[i];
        }
    }

    std::hash::keccak256(proofHash, 64)
}
