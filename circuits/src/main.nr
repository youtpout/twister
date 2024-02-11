use dep::std;

fn main(
    secret: Field,
    oldAmount: Field,
    // tree with 16 depth for test
    witnesses: [Field; 16],
    leafIndex: Field,
    leaf: pub Field,
    merkleRoot: pub Field,
    nullifier: pub Field,
    amount: pub Field,
    receiver: pub Field,
    relayer: pub Field,
    deposit: pub Field
) {
    if deposit == 1 {
        // we check on deposit if the user deposit the correct amount of eth
        assert(oldAmount == amount);
        let newLeaf = std::hash::poseidon::bn254::hash_2([secret, amount]);
        if (leaf != 0) {
            // verify only if leaf, so we can generate lead in first place and verify it on deposit
            assert(newLeaf == leaf);
        }
    } else {
        // we need to define relayer and receiver to withdraw, relayer and receiver can be the same account
        assert(receiver != 0);
        assert(relayer != 0);
        checkWithdraw(secret, oldAmount, leaf, leafIndex, witnesses, merkleRoot, nullifier, amount);
    }
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
) {
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

    let root = compute_merkle_root(hashSecret, leafIndex, witnesses);
    assert(root == merkleRoot);

    // generate new leaf for next withdraw
    let newLeaf = std::hash::poseidon::bn254::hash_2([secret, newAmount]);
    assert(newLeaf == leaf);
}

// update of noir implementation to use poseidon
fn compute_merkle_root<N>(leaf: Field, index: Field, hash_path: [Field; N]) -> Field {
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
fn test_hash_poseidon() {
    let hash_2 = std::hash::poseidon::bn254::hash_2([1, 1]);
    std::println("hash poseidon 1,1");
    std::println(hash_2);
}

#[test]
fn test_generate_deposit_leaf() {
    let witnesses: [Field;16] = [0; 16];
    let result = main(
        1,
        250000000000000000,
        witnesses,
        0,
        0,
        0,
        0,
        250000000000000000,
        0,
        0,
        1
    );
    std::println("result deposit");
    std::println(result);
}
