//! Radica media contract: one immutable image, addressed by its content.
//! Parameters: the 32-byte BLAKE3 hash of the image. State: the image's bytes (at most MAX_MEDIA).
//! A state is valid only when it hashes to the parameters, so nobody can publish other bytes at that address,
//! and there is nothing to merge: the only valid state is the one the address names.
//! A post refers to it as `media_uri = "radica-media:<hash hex>"` (signed with the post, see contract/).

use freenet_stdlib::prelude::*;

/// Same cap as an image kept inside a feed (contract/ MAX_MEDIA).
pub const MAX_MEDIA: usize = 768 * 1024;

/// Whether `state` is the image `params` names.
pub fn valid(params: &[u8], state: &[u8]) -> bool {
    params.len() == 32 && !state.is_empty() && state.len() <= MAX_MEDIA && blake3::hash(state).as_bytes() == params
}

pub struct RadicaMediaContract;

#[contract]
impl ContractInterface for RadicaMediaContract {
    fn validate_state(p: Parameters<'static>, state: State<'static>, _r: RelatedContracts<'static>) -> Result<ValidateResult, ContractError> {
        Ok(if valid(p.as_ref(), state.as_ref()) { ValidateResult::Valid } else { ValidateResult::Invalid })
    }

    /// Keeps the valid image, whichever side has it; anything else is refused.
    fn update_state(p: Parameters<'static>, state: State<'static>, data: Vec<UpdateData<'static>>) -> Result<UpdateModification<'static>, ContractError> {
        if valid(p.as_ref(), state.as_ref()) {
            return Ok(UpdateModification::valid(state));
        }
        for item in data {
            let bytes = match item {
                UpdateData::State(s) => s.as_ref().to_vec(),
                UpdateData::Delta(d) => d.as_ref().to_vec(),
                UpdateData::StateAndDelta { state, .. } => state.as_ref().to_vec(),
                _ => continue,
            };
            if valid(p.as_ref(), &bytes) {
                return Ok(UpdateModification::valid(State::from(bytes)));
            }
        }
        Err(ContractError::InvalidUpdate)
    }

    /// One byte: 1 when this peer holds the image.
    fn summarize_state(p: Parameters<'static>, state: State<'static>) -> Result<StateSummary<'static>, ContractError> {
        Ok(StateSummary::from(vec![valid(p.as_ref(), state.as_ref()) as u8]))
    }

    /// The whole image to a peer that lacks it, nothing to one that has it.
    fn get_state_delta(p: Parameters<'static>, state: State<'static>, summary: StateSummary<'static>) -> Result<StateDelta<'static>, ContractError> {
        let has = summary.as_ref().first() == Some(&1);
        Ok(StateDelta::from(if has || !valid(p.as_ref(), state.as_ref()) { vec![] } else { state.as_ref().to_vec() }))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn params(b: &[u8]) -> Parameters<'static> {
        Parameters::from(blake3::hash(b).as_bytes().to_vec())
    }
    const IMG: &[u8] = b"\x89PNG not really an image";

    #[test]
    fn only_the_named_bytes_are_valid() {
        let p = params(IMG);
        assert_eq!(RadicaMediaContract::validate_state(p.clone(), State::from(IMG.to_vec()), RelatedContracts::new()).unwrap(), ValidateResult::Valid);
        assert_eq!(RadicaMediaContract::validate_state(p.clone(), State::from(b"other".to_vec()), RelatedContracts::new()).unwrap(), ValidateResult::Invalid);
        assert_eq!(RadicaMediaContract::validate_state(p, State::from(vec![]), RelatedContracts::new()).unwrap(), ValidateResult::Invalid);
    }

    #[test]
    fn too_big_is_refused_even_with_its_hash() {
        let big = vec![7u8; MAX_MEDIA + 1];
        assert!(!valid(params(&big).as_ref(), &big));
        let max = vec![7u8; MAX_MEDIA];
        assert!(valid(params(&max).as_ref(), &max));
    }

    #[test]
    fn update_keeps_or_adopts_the_valid_image() {
        let p = params(IMG);
        let ok = |m: UpdateModification| m.new_state.unwrap().as_ref().to_vec();
        // empty state takes the image from an update
        let m = RadicaMediaContract::update_state(p.clone(), State::from(vec![]), vec![UpdateData::State(State::from(IMG.to_vec()))]).unwrap();
        assert_eq!(ok(m), IMG);
        // a held image is never replaced
        let m = RadicaMediaContract::update_state(p.clone(), State::from(IMG.to_vec()), vec![UpdateData::State(State::from(b"evil".to_vec()))]).unwrap();
        assert_eq!(ok(m), IMG);
        // nothing valid anywhere: refused
        assert!(RadicaMediaContract::update_state(p, State::from(vec![]), vec![UpdateData::Delta(StateDelta::from(b"evil".to_vec()))]).is_err());
    }

    #[test]
    fn delta_only_to_a_peer_without_it() {
        let p = params(IMG);
        let s = State::from(IMG.to_vec());
        let sum = RadicaMediaContract::summarize_state(p.clone(), s.clone()).unwrap();
        assert!(RadicaMediaContract::get_state_delta(p.clone(), s.clone(), sum).unwrap().as_ref().is_empty());
        let d = RadicaMediaContract::get_state_delta(p, s, StateSummary::from(vec![0])).unwrap();
        assert_eq!(d.as_ref(), IMG);
    }
}
