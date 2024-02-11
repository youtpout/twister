use dep::std;

fn main(
    secret: Field,
    oldAmount: Field,
    // tree with 16 depth for test
    witnesses: [Field; 16],
    leaf: pub Field,
    leafIndex: pub Field,
    merkleRoot: pub Field,
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
        if (leaf != 0) {
            // verify only if leaf, so we can generate lead in first place and verify it on deposit
            assert(newLeaf == leaf);
        }
        result = [newLeaf,nullifier];
    } else {
        // we need to define relayer and receiver to withdraw, relayer and receiver can be the same account
        assert(receiver != 0);
        assert(relayer != 0);
        result = checkWithdraw(
            secret,
            oldAmount,
            leaf,
            leafIndex,
            witnesses,
            merkleRoot,
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
    leafIndex: Field,
    witnesses: [Field; 16],
    merkleRoot: Field,
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
    let hashSecret = std::hash::poseidon::bn254::hash_2([oldAmount, secret]);
    assert(hashSecret == leaf);

    let root = compute_merkle_root(leaf, leafIndex, witnesses);
    assert(root == merkleRoot);

    // generate new leaf and new nullifier for next withdraw
    let newLeaf = std::hash::poseidon::bn254::hash_2([secret, newAmount]);
    let newNullifier = std::hash::pedersen_hash([newAmount, secret]);
    [newLeaf, newNullifier]
}

fn hashPedersen(leafLeft: Field, leafRight: Field) -> pub Field {
    let result = std::hash::pedersen_hash([leafLeft, leafRight]);
    result
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

// update of noir implementation to use poseidon
pub fn compute_merkle_root<N>(leaf: Field, index: Field, hash_path: [Field; N]) -> Field {
    let n = hash_path.len();
    let index_bits = index.to_le_bits(n as u32);
    let mut current = leaf;
    for i in 0..n {
        let path_bit = index_bits[i] as bool;
        let (hash_left, hash_right) = if path_bit {
            (hash_path[i], current)
        } else {
            (current, hash_path[i])
        };
        current = std::hash::poseidon::bn254::hash_2([hash_left, hash_right]);
    }
    current
}

#[test]
fn test_hash() {
    let commitment_0 = std::hash::pedersen_hash([1, 1]);

    let commit2= hashPedersen(1, 1);
    std::println("hash 1,1");
    std::println(commitment_0);
    assert(commitment_0 == commit2);
}

#[test]
fn test_hash_mimc() {
    let commitment_0 = std::hash::mimc::mimc_bn254([1, 1]);

    let commit2= hashPedersen(1, 1);
    std::println("hash mimc 1,1");
    std::println(commitment_0);
    //assert(commitment_0 == commit2);
}

#[test]
fn test_hash_poseidon() {
    let hash_2 = std::hash::poseidon::bn254::hash_2([1, 1]);
    std::println("hash poseidon 1,1");
    std::println(hash_2);
}
