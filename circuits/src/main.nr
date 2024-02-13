use dep::std;

fn main(
    secret: Field,
    oldAmount: Field,
    // tree with 8 depth for test, 7 witness
    witnesses: [Field; 8],
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
    witnesses: [Field; 8],
    merkleRoot: Field,
    nullifier: Field,
    amount: Field
) {
    let hash_secretNullifer = std::hash::poseidon::bn254::hash_2([oldAmount, secret]);
    assert(nullifier == hash_secretNullifer);

    // uint112 type like uniswap pool
    let amountOut = amount as u112;
    let amountOld = oldAmount as u112;
    // we can't withdraw more than actual account amount
    assert(amountOut <= amountOld);

    let newAmount = oldAmount - amount;

    // check if leaf match secret and amount
    let hashSecret = std::hash::poseidon::bn254::hash_2([secret, oldAmount]);

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
        //std::println("current");
        //std::println(current);
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
    let witnesses: [Field;8] = [0; 8];
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

#[test]
fn test_merkle_root() {
    let witnesses: [Field;2] = [
        0,
        0x2098f5fb9e239eab3ceac3f27b81e481dc3124d55ffed523a839ee8446b64864
    ];
    let hashSecret = std::hash::poseidon::bn254::hash_2([1, 250000000000000000]);
    std::println("hashSecret");
    std::println(hashSecret);
    let root = compute_merkle_root(hashSecret, 0, witnesses);

    std::println("expected root");
    std::println(root);
}

#[test]
fn test_merkle_root2() {
    let witnesses: [Field;2] = [
        0x191e3a4e10e469f9b6408e9ca05581ca1b303ff148377553b1655c04ee0f7caf,
        0x2098f5fb9e239eab3ceac3f27b81e481dc3124d55ffed523a839ee8446b64864
    ];
    let hashSecret = std::hash::poseidon::bn254::hash_2([1, 250000000000000000]);
    let root = compute_merkle_root(hashSecret, 1, witnesses);

    std::println("expected root");
    std::println(root);
}

